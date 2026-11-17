/**
 * Making, converting, duplicating, filtering and adding up documents.
 * Pure, checked by `npm test`; src/db/repo.ts stores what these return.
 */
import { computeTotals } from './money.ts';
import type { Totals } from './money.ts';
import { addDays, monthKey } from './dates.ts';
import { blankLine, convertTargets, EMPTY_CLIENT, statusesFor } from './model.ts';
import type { ClientSnap, Doc, DocType, Line, Status } from './model.ts';
import type { Defaults } from './settings.ts';

/** The smallest step of a currency in minor units (yen and won have no decimals). */
export function stepFor(currency: string): number {
  return ZERO_DECIMAL.includes(currency) ? 100 : 1;
}
const ZERO_DECIMAL = ['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'HUF', 'TWD', 'COP', 'IDR', 'PYG', 'UGX', 'XAF', 'XOF'];

export function docTotals(d: Pick<Doc, 'lines' | 'discountKind' | 'discountValue' | 'taxRate' | 'paid' | 'currency'>): Totals {
  return computeTotals({ lines: d.lines, discountKind: d.discountKind, discountValue: d.discountValue, taxRate: d.taxRate, paid: d.paid, step: stepFor(d.currency) });
}

export function dueFor(type: DocType, issue: string, defaults: Pick<Defaults, 'dueDays' | 'validDays'>): string | null {
  if (type === 'invoice') return addDays(issue, defaults.dueDays);
  if (type === 'estimate' || type === 'quote') return addDays(issue, defaults.validDays);
  return null;
}

/** A new draft of a type, with today's date, the defaults and one empty line. */
export function makeDoc(opts: { id: string; lineId: string; type: DocType; number: string; today: string; now: number; defaults: Defaults; client?: { id: string | null; snap: ClientSnap } }): Doc {
  const { type, defaults } = opts;
  return {
    id: opts.id,
    type,
    number: opts.number,
    status: type === 'receipt' ? 'paid' : 'draft',
    clientId: opts.client?.id ?? null,
    client: opts.client?.snap ?? { ...EMPTY_CLIENT },
    issueDate: opts.today,
    dueDate: dueFor(type, opts.today, defaults),
    currency: defaults.currency,
    lines: [blankLine(opts.lineId)],
    discountKind: 'percent',
    discountValue: 0,
    taxRate: defaults.taxRate,
    taxLabel: defaults.taxLabel,
    paid: 0,
    paymentNote: '',
    notes: defaults.notes[type],
    terms: defaults.terms[type],
    ownerSign: true,
    clientSigned: null,
    sourceId: null,
    createdAt: opts.now,
    updatedAt: opts.now,
  };
}

/**
 * One tap from an estimate or quote to an invoice, or from an invoice to a
 * receipt. Every line, the client, the discount and the tax carry over; the
 * new one has its own number, today's date and the target type's terms. An
 * invoice becomes a receipt for its whole total. Returns the new document
 * and the status the source should move to (accepted, or paid).
 */
export function convertDoc(src: Doc, target: DocType, opts: { id: string; number: string; today: string; now: number; defaults: Defaults; lineIds: string[] }): { doc: Doc; sourceStatus: Status } {
  if (!convertTargets(src.type).includes(target)) throw new Error(`A ${src.type} cannot become a ${target}.`);
  const lines: Line[] = src.lines.map((l, i) => ({ ...l, id: opts.lineIds[i] ?? `${opts.id}-${i}` }));
  const base: Doc = {
    ...src,
    id: opts.id,
    type: target,
    number: opts.number,
    lines,
    issueDate: opts.today,
    dueDate: dueFor(target, opts.today, opts.defaults),
    terms: opts.defaults.terms[target] || src.terms,
    clientSigned: target === 'invoice' ? src.clientSigned : null,
    sourceId: src.id,
    createdAt: opts.now,
    updatedAt: opts.now,
  };
  if (target === 'receipt') {
    const t = docTotals(base);
    return { doc: { ...base, status: 'paid', paid: Math.max(0, t.total), clientSigned: null }, sourceStatus: 'paid' };
  }
  return { doc: { ...base, status: 'draft' }, sourceStatus: 'accepted' };
}

/** A fresh copy of a document: same type, lines and client; new number, today's date, a draft, no signature. */
export function duplicateDoc(src: Doc, opts: { id: string; number: string; today: string; now: number; defaults: Defaults; lineIds: string[] }): Doc {
  return {
    ...src,
    id: opts.id,
    number: opts.number,
    status: src.type === 'receipt' ? 'paid' : 'draft',
    lines: src.lines.map((l, i) => ({ ...l, id: opts.lineIds[i] ?? `${opts.id}-${i}` })),
    issueDate: opts.today,
    dueDate: dueFor(src.type, opts.today, opts.defaults),
    paid: src.type === 'receipt' ? src.paid : 0,
    clientSigned: null,
    sourceId: null,
    createdAt: opts.now,
    updatedAt: opts.now,
  };
}

/** A status that fits the type, or the type's first. */
export function fitStatus(type: DocType, status: Status): Status {
  const ok = statusesFor(type);
  return ok.includes(status) ? status : ok[0];
}

/** What the list and the home numbers need, without the lines. */
export interface DocRow {
  id: string;
  type: DocType;
  number: string;
  status: Status;
  clientId: string | null;
  clientName: string;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  total: number;
  balance: number;
  sourceId: string | null;
  updatedAt: number;
}

export function rowOf(d: Doc): DocRow {
  const t = docTotals(d);
  return { id: d.id, type: d.type, number: d.number, status: d.status, clientId: d.clientId, clientName: d.client.name, issueDate: d.issueDate, dueDate: d.dueDate, currency: d.currency, total: t.total, balance: t.balance, sourceId: d.sourceId, updatedAt: d.updatedAt };
}

export interface Filter {
  query: string;
  type: DocType | null;
  status: Status | null;
  clientId: string | null;
}

export const NO_FILTER: Filter = { query: '', type: null, status: null, clientId: null };

const fold = (s: string) => s.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Search matches the number, the client and the amount as typed; filters narrow by type, status and client. Newest first. */
export function filterRows(rows: DocRow[], f: Filter): DocRow[] {
  const q = fold(f.query.trim());
  return rows
    .filter((r) => (f.type ? r.type === f.type : true))
    .filter((r) => (f.status ? r.status === f.status : true))
    .filter((r) => (f.clientId ? r.clientId === f.clientId : true))
    .filter((r) => {
      if (!q) return true;
      const amount = (r.total / 100).toFixed(2);
      return fold(r.number).includes(q) || fold(r.clientName).includes(q) || amount.includes(q.replace(/[^\d.]/g, '') || '\u0000');
    })
    .sort((a, b) => (a.issueDate === b.issueDate ? b.updatedAt - a.updatedAt : a.issueDate < b.issueDate ? 1 : -1));
}

/** Overdue: an invoice that is out, not paid, with money owing, past its due date. */
export function isOverdue(r: Pick<DocRow, 'type' | 'status' | 'dueDate' | 'balance'>, today: string): boolean {
  return r.type === 'invoice' && r.status === 'sent' && r.balance > 0 && r.dueDate != null && r.dueDate < today;
}

export interface Summary {
  /** Billed this month: invoices dated this month that are out (sent or paid), plus receipts not made from an invoice. */
  month: Record<string, number>;
  /** Owed: invoices that are out and not marked paid, by what is left to pay. */
  unpaid: Record<string, number>;
  unpaidCount: number;
  overdueCount: number;
}

/** The two numbers on the home screen, per currency. Drafts count in neither until they go out. */
export function summarize(rows: DocRow[], today: string): Summary {
  const month: Record<string, number> = {};
  const unpaid: Record<string, number> = {};
  let unpaidCount = 0;
  let overdueCount = 0;
  const add = (o: Record<string, number>, c: string, v: number) => (o[c] = (o[c] ?? 0) + v);
  const m = monthKey(today);
  for (const r of rows) {
    if (r.type === 'invoice' && r.status !== 'draft') {
      if (monthKey(r.issueDate) === m) add(month, r.currency, r.total);
      if (r.status === 'sent' && r.balance > 0) {
        add(unpaid, r.currency, r.balance);
        unpaidCount++;
        if (isOverdue(r, today)) overdueCount++;
      }
    }
  }
  // Receipts that were not made from an invoice in the list are money in too (a walk-in sale).
  const invoices = new Set(rows.filter((r) => r.type === 'invoice').map((r) => r.id));
  for (const r of rows) if (r.type === 'receipt' && monthKey(r.issueDate) === m && !(r.sourceId && invoices.has(r.sourceId))) add(month, r.currency, r.total);
  return { month, unpaid, unpaidCount, overdueCount };
}
