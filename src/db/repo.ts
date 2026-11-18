/**
 * Reading and writing the database through the Db interface. No native
 * imports: the app passes expo-sqlite, the tests pass node:sqlite, and the
 * same SQL runs on both.
 */
import type { Db, Param } from './schema.ts';
import type { Counter } from '../numbering.ts';
import { bumpPast, cleanNext, cleanPrefix, DEFAULT_COUNTERS, take } from '../numbering.ts';
import type { ClientSnap, Doc, DocType, Line, Signed, Status } from '../model.ts';
import { DOC_TYPES, newId } from '../model.ts';
import { convertDoc, docTotals, duplicateDoc, fitStatus } from '../docs.ts';
import type { DocRow } from '../docs.ts';
import type { Defaults } from '../settings.ts';

// ---------- key/value ----------

export async function kvGet(db: Db, key: string): Promise<string | null> {
  const r = await db.get<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key]);
  return r ? r.value : null;
}

export async function kvSet(db: Db, key: string, value: string): Promise<void> {
  await db.run('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

export async function kvDelete(db: Db, key: string): Promise<void> {
  await db.run('DELETE FROM kv WHERE key = ?', [key]);
}

// ---------- numbering ----------

export async function getCounters(db: Db): Promise<Record<DocType, Counter>> {
  const rows = await db.all<{ type: string; prefix: string; next: number }>('SELECT type, prefix, next FROM counters');
  const out = { ...DEFAULT_COUNTERS };
  for (const r of rows) if ((DOC_TYPES as string[]).includes(r.type)) out[r.type as DocType] = { prefix: r.prefix, next: cleanNext(r.next) };
  return out;
}

export async function setCounter(db: Db, type: DocType, c: Counter): Promise<void> {
  await db.run('INSERT INTO counters (type, prefix, next) VALUES (?, ?, ?) ON CONFLICT(type) DO UPDATE SET prefix = excluded.prefix, next = excluded.next', [type, cleanPrefix(c.prefix), cleanNext(c.next)]);
}

/** Takes the next number for a type and moves its counter on. Call inside the transaction that saves the document. */
export async function takeNumber(db: Db, type: DocType): Promise<string> {
  const c = (await getCounters(db))[type];
  const { number, counter } = take(c);
  await setCounter(db, type, counter);
  return number;
}

// ---------- clients ----------

export interface Client extends ClientSnap {
  id: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

type ClientRow = { id: string; name: string; email: string; phone: string; address: string; notes: string; created_at: number; updated_at: number };

const toClient = (r: ClientRow): Client => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, address: r.address, notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at });

export async function listClients(db: Db): Promise<Client[]> {
  return (await db.all<ClientRow>('SELECT * FROM clients ORDER BY name COLLATE NOCASE, created_at')).map(toClient);
}

/** Saves a client. Drafts for this client pick up the new details; documents that went out keep what they printed. */
export async function saveClient(db: Db, c: Client): Promise<void> {
  await db.tx(async () => {
    await db.run(
      `INSERT INTO clients (id, name, email, phone, address, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email, phone = excluded.phone, address = excluded.address, notes = excluded.notes, updated_at = excluded.updated_at`,
      [c.id, c.name.trim(), c.email.trim(), c.phone.trim(), c.address.trim(), c.notes, c.createdAt, c.updatedAt]
    );
    await db.run("UPDATE docs SET client_name = ?, client_email = ?, client_phone = ?, client_address = ? WHERE client_id = ? AND status = 'draft'", [c.name.trim(), c.email.trim(), c.phone.trim(), c.address.trim(), c.id]);
  });
}

/** Deletes a client. Their documents stay, with the name and address they printed. */
export async function deleteClient(db: Db, id: string): Promise<void> {
  await db.tx(async () => {
    await db.run('DELETE FROM clients WHERE id = ?', [id]);
    await db.run('UPDATE docs SET client_id = NULL WHERE client_id = ?', [id]);
  });
}

// ---------- saved items ----------

export interface Item {
  id: string;
  description: string;
  /** Minor units. */
  rate: number;
  unit: string;
  taxable: boolean;
  createdAt: number;
  updatedAt: number;
}

type ItemRow = { id: string; description: string; rate: number; unit: string; taxable: number; created_at: number; updated_at: number };

const toItem = (r: ItemRow): Item => ({ id: r.id, description: r.description, rate: r.rate, unit: r.unit, taxable: r.taxable !== 0, createdAt: r.created_at, updatedAt: r.updated_at });

export async function listItems(db: Db): Promise<Item[]> {
  return (await db.all<ItemRow>('SELECT * FROM items ORDER BY description COLLATE NOCASE, created_at')).map(toItem);
}

export async function saveItem(db: Db, it: Item): Promise<void> {
  await db.run(
    `INSERT INTO items (id, description, rate, unit, taxable, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET description = excluded.description, rate = excluded.rate, unit = excluded.unit, taxable = excluded.taxable, updated_at = excluded.updated_at`,
    [it.id, it.description.trim(), Math.round(it.rate), it.unit.trim(), it.taxable ? 1 : 0, it.createdAt, it.updatedAt]
  );
}

export async function deleteItem(db: Db, id: string): Promise<void> {
  await db.run('DELETE FROM items WHERE id = ?', [id]);
}

// ---------- documents ----------

type DocRowDb = {
  id: string;
  type: string;
  number: string;
  status: string;
  client_id: string | null;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_address: string;
  issue_date: string;
  due_date: string | null;
  currency: string;
  discount_kind: string;
  discount_value: number;
  tax_rate: number;
  tax_label: string;
  paid: number;
  payment_note: string;
  notes: string;
  terms: string;
  owner_sign: number;
  client_signed: string | null;
  source_id: string | null;
  total: number;
  balance: number;
  created_at: number;
  updated_at: number;
};

type LineRowDb = { id: string; doc_id: string; position: number; description: string; qty: number; unit: string; rate: number; taxable: number };

const asType = (t: string): DocType => ((DOC_TYPES as string[]).includes(t) ? (t as DocType) : 'estimate');

function parseSigned(json: string | null): Signed | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    if (!v || !Array.isArray(v.strokes) || !(v.width > 0) || !(v.height > 0)) return null;
    return { strokes: v.strokes, width: v.width, height: v.height, name: typeof v.name === 'string' ? v.name : '', at: Number(v.at) || 0 };
  } catch {
    return null;
  }
}

function toDoc(r: DocRowDb, lines: LineRowDb[]): Doc {
  const type = asType(r.type);
  return {
    id: r.id,
    type,
    number: r.number,
    status: fitStatus(type, r.status as Status),
    clientId: r.client_id,
    client: { name: r.client_name, email: r.client_email, phone: r.client_phone, address: r.client_address },
    issueDate: r.issue_date,
    dueDate: r.due_date,
    currency: r.currency,
    lines: lines.map((l): Line => ({ id: l.id, description: l.description, qty: l.qty, unit: l.unit, rate: l.rate, taxable: l.taxable !== 0 })),
    discountKind: r.discount_kind === 'amount' ? 'amount' : 'percent',
    discountValue: r.discount_value,
    taxRate: r.tax_rate,
    taxLabel: r.tax_label,
    paid: r.paid,
    paymentNote: r.payment_note,
    notes: r.notes,
    terms: r.terms,
    ownerSign: r.owner_sign !== 0,
    clientSigned: parseSigned(r.client_signed),
    sourceId: r.source_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toRow(r: DocRowDb): DocRow {
  const type = asType(r.type);
  return { id: r.id, type, number: r.number, status: fitStatus(type, r.status as Status), clientId: r.client_id, clientName: r.client_name, issueDate: r.issue_date, dueDate: r.due_date, currency: r.currency, total: r.total, balance: r.balance, sourceId: r.source_id, updatedAt: r.updated_at };
}

const ROW_COLS = 'id, type, number, status, client_id, client_name, issue_date, due_date, currency, total, balance, source_id, updated_at';

export async function listRows(db: Db): Promise<DocRow[]> {
  return (await db.all<DocRowDb>(`SELECT ${ROW_COLS} FROM docs ORDER BY issue_date DESC, updated_at DESC`)).map(toRow);
}

export async function getDoc(db: Db, id: string): Promise<Doc | null> {
  const r = await db.get<DocRowDb>('SELECT * FROM docs WHERE id = ?', [id]);
  if (!r) return null;
  const lines = await db.all<LineRowDb>('SELECT * FROM lines WHERE doc_id = ? ORDER BY position', [id]);
  return toDoc(r, lines);
}

async function writeDoc(db: Db, d: Doc): Promise<void> {
  const t = docTotals(d);
  const p: Param[] = [
    d.id, d.type, d.number, fitStatus(d.type, d.status), d.clientId, d.client.name, d.client.email, d.client.phone, d.client.address,
    d.issueDate, d.dueDate, d.currency, d.discountKind, d.discountValue, d.taxRate, d.taxLabel, Math.round(d.paid), d.paymentNote,
    d.notes, d.terms, d.ownerSign ? 1 : 0, d.clientSigned ? JSON.stringify(d.clientSigned) : null, d.sourceId, t.total, t.balance, d.createdAt, d.updatedAt,
  ];
  await db.run(
    `INSERT INTO docs (id, type, number, status, client_id, client_name, client_email, client_phone, client_address,
      issue_date, due_date, currency, discount_kind, discount_value, tax_rate, tax_label, paid, payment_note,
      notes, terms, owner_sign, client_signed, source_id, total, balance, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET type = excluded.type, number = excluded.number, status = excluded.status, client_id = excluded.client_id,
      client_name = excluded.client_name, client_email = excluded.client_email, client_phone = excluded.client_phone, client_address = excluded.client_address,
      issue_date = excluded.issue_date, due_date = excluded.due_date, currency = excluded.currency, discount_kind = excluded.discount_kind,
      discount_value = excluded.discount_value, tax_rate = excluded.tax_rate, tax_label = excluded.tax_label, paid = excluded.paid,
      payment_note = excluded.payment_note, notes = excluded.notes, terms = excluded.terms, owner_sign = excluded.owner_sign,
      client_signed = excluded.client_signed, source_id = excluded.source_id, total = excluded.total, balance = excluded.balance, updated_at = excluded.updated_at`,
    p
  );
  await db.run('DELETE FROM lines WHERE doc_id = ?', [d.id]);
  for (let i = 0; i < d.lines.length; i++) {
    const l = d.lines[i];
    await db.run('INSERT INTO lines (id, doc_id, position, description, qty, unit, rate, taxable) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [l.id, d.id, i, l.description, l.qty, l.unit, Math.round(l.rate), l.taxable ? 1 : 0]);
  }
  // A number typed by hand ahead of the sequence moves the counter past it.
  const c = (await getCounters(db))[d.type];
  const moved = bumpPast(c, d.number);
  if (moved !== c) await setCounter(db, d.type, moved);
}

/** Saves a document and its lines in one go, with its totals worked out again. */
export async function saveDoc(db: Db, d: Doc): Promise<void> {
  await db.tx(() => writeDoc(db, d));
}

/** A new document: takes the type's next number and saves it, in one transaction. */
export async function createDoc(db: Db, type: DocType, build: (number: string) => Doc): Promise<Doc> {
  let made: Doc | null = null;
  await db.tx(async () => {
    made = build(await takeNumber(db, type));
    await writeDoc(db, made);
  });
  return made!;
}

/**
 * One tap: an estimate or quote becomes an invoice (the estimate is marked
 * accepted), an invoice becomes a receipt (the invoice is marked paid).
 * All in one transaction. Returns the new document.
 */
export async function convertAndSave(db: Db, id: string, target: DocType, ctx: { today: string; now: number; defaults: Defaults }): Promise<Doc | null> {
  let made: Doc | null = null;
  await db.tx(async () => {
    const src = await getDoc(db, id);
    if (!src) return;
    const number = await takeNumber(db, target);
    const { doc, sourceStatus } = convertDoc(src, target, { id: newId(ctx.now), number, today: ctx.today, now: ctx.now, defaults: ctx.defaults, lineIds: ids(src.lines.length, ctx.now) });
    await writeDoc(db, doc);
    // An invoice that became a receipt was paid in full.
    if (sourceStatus === 'paid') await db.run("UPDATE docs SET status = 'paid', paid = total, balance = 0, updated_at = ? WHERE id = ?", [ctx.now, src.id]);
    else await db.run('UPDATE docs SET status = ?, updated_at = ? WHERE id = ?', [fitStatus(src.type, sourceStatus), ctx.now, src.id]);
    made = doc;
  });
  return made;
}

/** A copy with the next number of its type. */
export async function duplicateAndSave(db: Db, id: string, ctx: { today: string; now: number; defaults: Defaults }): Promise<Doc | null> {
  let made: Doc | null = null;
  await db.tx(async () => {
    const src = await getDoc(db, id);
    if (!src) return;
    const number = await takeNumber(db, src.type);
    made = duplicateDoc(src, { id: newId(ctx.now), number, today: ctx.today, now: ctx.now, defaults: ctx.defaults, lineIds: ids(src.lines.length, ctx.now) });
    await writeDoc(db, made);
  });
  return made;
}

export async function setStatus(db: Db, id: string, status: Status, now: number): Promise<void> {
  const d = await getDoc(db, id);
  if (!d) return;
  await db.run('UPDATE docs SET status = ?, updated_at = ? WHERE id = ?', [fitStatus(d.type, status), now, id]);
}

export async function deleteDoc(db: Db, id: string): Promise<void> {
  await db.tx(async () => {
    await db.run('DELETE FROM lines WHERE doc_id = ?', [id]);
    await db.run('DELETE FROM docs WHERE id = ?', [id]);
  });
}

/** Ids for new lines (and anything else), unique enough on one phone. */
export function ids(n: number, now = Date.now()): string[] {
  return Array.from({ length: n }, () => newId(now));
}
