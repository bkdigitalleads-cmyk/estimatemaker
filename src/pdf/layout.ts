/**
 * The page layout for every document, as a list of drawing operations on
 * pages measured in points, top-left origin. Pure: the PDF writer (pdf.ts,
 * pdf-lib) and the on-screen preview (ui/PageView.tsx, Skia) both draw these
 * same operations, so what you see is what prints. Checked by `npm test`.
 *
 * Three templates, each with one accent color:
 *   ledger - ruled rows, a boxed total, the type in large condensed capitals
 *   banner - a band of the accent across the top, the totals' last line on it too
 *   plain  - no fills, thin rules, plenty of white space
 * Every page prints the person's own business details at the top; nothing
 * else names a business.
 */
import type { Doc } from '../model.ts';
import { dueLabel, TYPE_LABEL } from '../model.ts';
import type { Business, OwnerSignature, Paper, TemplateId } from '../settings.ts';
import { docTotals } from '../docs.ts';
import { formatDate, formatMoney, formatNumber } from '../format.ts';
import { strokePath, strokesBounds } from '../stroke.ts';
import type { Stroke } from '../stroke.ts';
import { isoDay } from '../dates.ts';

export type FontKey = 'regular' | 'bold' | 'display' | 'mono';

export interface Measure {
  /** Width of the text in points at this size, as the PDF will set it. */
  width(text: string, font: FontKey, size: number): number;
  /** The text with anything the font cannot draw replaced. */
  clean(text: string, font: FontKey): string;
}

export type Op =
  | { k: 'text'; x: number; y: number; text: string; font: FontKey; size: number; color: string; rotate?: number }
  | { k: 'rect'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; lw?: number; rotate?: number }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; lw: number }
  | { k: 'image'; x: number; y: number; w: number; h: number }
  | { k: 'path'; d: string; tx: number; ty: number; s: number; color: string };

export interface Page {
  width: number;
  height: number;
  ops: Op[];
}

export interface LayoutInput {
  doc: Doc;
  business: Business;
  /** The logo's pixel size; the PNG itself goes to the writer. */
  logo: { width: number; height: number } | null;
  ownerSignature: OwnerSignature | null;
  template: TemplateId;
  accent: string;
  paper: Paper;
  locale: string;
}

export const PAPER_SIZE: Record<Paper, { width: number; height: number }> = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 },
};

const INK = '#1B1B1F';
const SOFT = '#5F5E5A';
const FAINT = '#8E8B84';
const RULE = '#D9D5CC';
const WHITE = '#FFFFFF';
const SIGN_INK = '#1A2A55';

/** The accent mixed into white, for tints behind text. */
export function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * (1 - amount));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

/** Splits text into lines no wider than max, at spaces, keeping the person's own line breaks; very long words are cut. */
export function wrap(m: Measure, text: string, font: FontKey, size: number, max: number): string[] {
  const out: string[] = [];
  for (const para of m.clean(text, font).split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push('');
      continue;
    }
    let line = '';
    for (let word of words) {
      while (m.width(word, font, size) > max && word.length > 1) {
        // A word wider than the column: cut it where it fits.
        let cut = word.length - 1;
        while (cut > 1 && m.width(word.slice(0, cut), font, size) > max) cut--;
        if (line) {
          out.push(line);
          line = '';
        }
        out.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      const next = line ? `${line} ${word}` : word;
      if (m.width(next, font, size) <= max) line = next;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  // No trailing blank lines.
  while (out.length > 1 && out[out.length - 1] === '') out.pop();
  return out;
}

/** Shortens one line with an ellipsis to fit. */
function fit(m: Measure, text: string, font: FontKey, size: number, max: number): string {
  const t = m.clean(text, font);
  if (m.width(t, font, size) <= max) return t;
  let s = t;
  while (s.length > 1 && m.width(`${s}...`, font, size) > max) s = s.slice(0, -1);
  return `${s.trimEnd()}...`;
}

interface Style {
  id: TemplateId;
  margin: number;
  body: number;
  small: number;
}

const STYLES: Record<TemplateId, Style> = {
  ledger: { id: 'ledger', margin: 44, body: 9.5, small: 8 },
  banner: { id: 'banner', margin: 44, body: 9.5, small: 8 },
  plain: { id: 'plain', margin: 56, body: 9.5, small: 8 },
};

/** Lays out a document on as many pages as its lines need. */
export function layoutDoc(m: Measure, input: LayoutInput): Page[] {
  const { doc, business, accent, locale } = input;
  const st = STYLES[input.template] ?? STYLES.ledger;
  const { width: W, height: H } = PAPER_SIZE[input.paper] ?? PAPER_SIZE.letter;
  const M = st.margin;
  const CW = W - 2 * M;
  const totals = docTotals(doc);
  const money = (v: number) => formatMoney(v, doc.currency, locale);
  const date = (iso: string) => formatDate(iso, locale);
  const title = TYPE_LABEL[doc.type].toUpperCase();

  const pages: Page[] = [];
  let ops: Op[] = [];
  let y = 0;
  const newPage = () => {
    ops = [];
    pages.push({ width: W, height: H, ops });
  };

  // ---- primitives ----
  const text = (x: number, yy: number, s: string, font: FontKey, size: number, color = INK, align: 'left' | 'right' | 'center' = 'left') => {
    const t = m.clean(s, font);
    if (!t) return;
    const w = m.width(t, font, size);
    const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    ops.push({ k: 'text', x: left, y: yy, text: t, font, size, color });
  };
  const hline = (x1: number, x2: number, yy: number, color = RULE, lw = 0.75) => ops.push({ k: 'line', x1, y1: yy, x2, y2: yy, color, lw });
  const rect = (x: number, yy: number, w: number, h: number, o: { fill?: string; stroke?: string; lw?: number }) => ops.push({ k: 'rect', x, y: yy, w, h, ...o });

  const bottom = H - M - 18; // room for the footer
  const ensure = (h: number, onBreak?: () => void) => {
    if (y + h <= bottom) return;
    newPage();
    y = continuationHeader();
    onBreak?.();
  };

  // ---- the business block (every first page) ----
  const businessLines = (): string[] =>
    [
      ...business.address.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
      [business.phone, business.email].filter(Boolean).join('   '),
      business.website,
      business.taxId,
    ].filter(Boolean);

  const logoBox = (maxW: number, maxH: number): { w: number; h: number } | null => {
    if (!input.logo) return null;
    const k = Math.min(maxW / input.logo.width, maxH / input.logo.height);
    return { w: input.logo.width * k, h: input.logo.height * k };
  };

  /** Number, dates, as label and value rows ending at x (right aligned). */
  const metaRows = (): [string, string][] => {
    const rows: [string, string][] = [[`${TYPE_LABEL[doc.type]} no.`, doc.number]];
    rows.push([doc.type === 'receipt' ? 'Paid on' : 'Date', date(doc.issueDate)]);
    const dl = dueLabel(doc.type);
    if (dl && doc.dueDate) rows.push([dl, date(doc.dueDate)]);
    return rows;
  };

  const header = (): number => {
    const lines = businessLines();
    const name = business.name.trim() || 'Your business name';
    const nameColor = business.name.trim() ? INK : FAINT;
    if (st.id === 'banner') {
      const bandH = 92;
      rect(0, 0, W, bandH, { fill: accent });
      let x = M;
      const lb = logoBox(120, 56);
      if (lb) {
        rect(M - 6, (bandH - lb.h) / 2 - 6, lb.w + 12, lb.h + 12, { fill: WHITE });
        ops.push({ k: 'image', x: M, y: (bandH - lb.h) / 2, w: lb.w, h: lb.h });
        x = M + lb.w + 20;
      }
      text(x, 44, fit(m, name, 'display', 20, W - x - M - 170), 'display', 20, WHITE);
      if (lines[0]) text(x, 62, fit(m, lines.slice(0, 2).join('   '), 'regular', st.small, W - x - M - 170), 'regular', st.small, tint(WHITE, 0.85));
      text(W - M, 56, title, 'display', 30, WHITE, 'right');
      let yy = bandH + 26;
      // Details under the band, left; number and dates right.
      const left = lines.slice(2);
      const rowsMeta = metaRows();
      const rows = Math.max(left.length, rowsMeta.length);
      for (let i = 0; i < rows; i++) {
        if (left[i]) text(M, yy, fit(m, left[i], 'regular', st.small, CW / 2), 'regular', st.small, SOFT);
        if (rowsMeta[i]) {
          text(W - M - 110, yy, rowsMeta[i][0], 'regular', st.small, SOFT, 'right');
          text(W - M, yy, rowsMeta[i][1], i === 0 ? 'mono' : 'regular', st.body, INK, 'right');
        }
        yy += 14;
      }
      return yy + 10;
    }

    // ledger and plain: logo and business on the left, the type and meta on the right.
    let yy = M;
    let x = M;
    const lb = logoBox(st.id === 'plain' ? 96 : 120, 54);
    if (lb) {
      ops.push({ k: 'image', x: M, y: yy, w: lb.w, h: lb.h });
      x = M + lb.w + 14;
    }
    const leftW = CW * 0.56 - (x - M);
    text(x, yy + 14, fit(m, name, 'bold', 13, leftW), 'bold', 13, nameColor);
    let ly = yy + 30;
    for (const l of lines) {
      text(x, ly, fit(m, l, 'regular', st.small, leftW), 'regular', st.small, SOFT);
      ly += 11.5;
    }
    const titleSize = st.id === 'plain' ? 22 : 34;
    text(W - M, yy + (st.id === 'plain' ? 18 : 26), title, 'display', titleSize, st.id === 'plain' ? INK : accent, 'right');
    let my = yy + (st.id === 'plain' ? 38 : 48);
    for (const [k, v] of metaRows()) {
      text(W - M - 96, my, k, 'regular', st.small, SOFT, 'right');
      text(W - M, my, v, k.endsWith('no.') ? 'mono' : 'regular', st.body, INK, 'right');
      my += 14;
    }
    yy = Math.max(ly, my, yy + (lb?.h ?? 0)) + 14;
    if (st.id === 'ledger') {
      ops.push({ k: 'line', x1: M, y1: yy, x2: W - M, y2: yy, color: accent, lw: 2 });
      yy += 22;
    } else yy += 14;
    return yy;
  };

  const continuationHeader = (): number => {
    let yy = M;
    text(M, yy + 10, fit(m, business.name || '', 'bold', 10, CW / 2), 'bold', 10, INK);
    text(W - M, yy + 10, `${TYPE_LABEL[doc.type]} ${doc.number}, continued`, 'regular', st.small, SOFT, 'right');
    yy += 22;
    hline(M, W - M, yy, st.id === 'plain' ? RULE : accent, st.id === 'plain' ? 0.75 : 1.2);
    return yy + 18;
  };

  // ---- the client ----
  const party = () => {
    const label = doc.type === 'invoice' ? 'BILL TO' : doc.type === 'receipt' ? 'RECEIVED FROM' : 'PREPARED FOR';
    const c = doc.client;
    const lines = [c.name, ...c.address.split(/\r?\n/), c.email, c.phone].map((s) => s.trim()).filter(Boolean);
    const startY = y;
    text(M, y, label, 'bold', st.small - 0.5, st.id === 'plain' ? SOFT : accent);
    y += 15;
    if (lines.length === 0) {
      text(M, y, ' ', 'regular', st.body);
      y += 13;
    }
    lines.forEach((l, i) => {
      text(M, y, fit(m, l, i === 0 ? 'bold' : 'regular', i === 0 ? 11 : st.body, CW * 0.55), i === 0 ? 'bold' : 'regular', i === 0 ? 11 : st.body, i === 0 ? INK : SOFT);
      y += i === 0 ? 15 : 12.5;
    });
    // Paid documents carry a stamp, like the rubber one.
    if (doc.status === 'paid' && (doc.type === 'invoice' || doc.type === 'receipt')) {
      const sx = W - M - 120;
      const sy = startY - 4;
      ops.push({ k: 'rect', x: sx, y: sy, w: 104, h: 38, stroke: accent, lw: 2, rotate: -8 });
      ops.push({ k: 'text', x: sx + 18, y: sy + 28, text: 'PAID', font: 'display', size: 26, color: accent, rotate: -8 });
    }
    y += 16;
  };

  // ---- the lines ----
  const colAmount = W - M;
  const colRate = W - M - 92;
  const colQty = W - M - 182;
  const descW = colQty - 46 - M - 8;
  const tableHead = () => {
    const h = 22;
    if (st.id === 'banner') rect(M, y, CW, h, { fill: tint(accent, 0.12) });
    else if (st.id === 'ledger') rect(M, y, CW, h, { fill: accent });
    const color = st.id === 'ledger' ? WHITE : st.id === 'banner' ? accent : SOFT;
    const by = y + 14.5;
    const pad = st.id === 'plain' ? 0 : 8;
    text(M + pad, by, 'DESCRIPTION', 'bold', st.small - 0.5, color);
    text(colQty, by, 'QTY', 'bold', st.small - 0.5, color, 'right');
    text(colRate, by, 'RATE', 'bold', st.small - 0.5, color, 'right');
    text(colAmount - pad, by, 'AMOUNT', 'bold', st.small - 0.5, color, 'right');
    y += h;
    if (st.id === 'plain') hline(M, W - M, y, INK, 0.75);
    y += 4;
  };

  const lineRows = () => {
    tableHead();
    const pad = st.id === 'plain' ? 0 : 8;
    const taxed = doc.taxRate > 0;
    doc.lines.forEach((l, i) => {
      const desc = wrap(m, l.description.trim() || ' ', 'regular', st.body, descW - pad);
      const extra = taxed && !l.taxable ? 1 : 0;
      const h = 8 + (desc.length + extra) * 12.5 + 4;
      ensure(h, tableHead);
      const by = y + 14;
      desc.forEach((d, j) => text(M + pad, by + j * 12.5, d, 'regular', st.body, INK));
      if (extra) text(M + pad, by + desc.length * 12.5, 'Not taxed', 'regular', st.small, FAINT);
      const qty = `${formatNumber(l.qty, locale)}${l.unit.trim() ? ` ${l.unit.trim()}` : ''}`;
      text(colQty, by, fit(m, qty, 'regular', st.body, 80), 'regular', st.body, INK, 'right');
      text(colRate, by, money(l.rate), 'regular', st.body, INK, 'right');
      text(colAmount - pad, by, money(totals.lineAmounts[i]), 'regular', st.body, INK, 'right');
      y += h;
      if (st.id === 'ledger' || i < doc.lines.length - 1) hline(M, W - M, y - 2, st.id === 'ledger' ? RULE : '#E7E3DB', 0.6);
    });
    y += 14;
  };

  // ---- totals, notes and terms side by side ----
  const totalsBlock = () => {
    const rows: { label: string; value: string; strong?: boolean; band?: boolean }[] = [{ label: 'Subtotal', value: money(totals.subtotal) }];
    if (totals.discount > 0) rows.push({ label: doc.discountKind === 'percent' ? `Discount ${formatNumber(doc.discountValue, locale)}%` : 'Discount', value: `-${money(totals.discount)}` });
    if (doc.taxRate > 0) rows.push({ label: `${doc.taxLabel} ${formatNumber(doc.taxRate, locale)}%`, value: money(totals.tax) });
    if (doc.type === 'receipt') {
      rows.push({ label: 'Total', value: money(totals.total), strong: true });
      rows.push({ label: 'Amount paid', value: money(totals.paid), strong: true, band: true });
      if (totals.balance !== 0) rows.push({ label: totals.balance < 0 ? 'Credit' : 'Balance due', value: money(Math.abs(totals.balance)) });
    } else if (totals.paid === 0) {
      // Nothing paid yet: the total is the last line, on the band.
      rows.push({ label: doc.type === 'invoice' ? 'Total due' : `${TYPE_LABEL[doc.type]} total`, value: money(totals.total), strong: true, band: true });
    } else {
      rows.push({ label: 'Total', value: money(totals.total), strong: true });
      rows.push({ label: doc.type === 'invoice' ? 'Paid' : 'Deposit paid', value: `-${money(totals.paid)}` });
      rows.push({ label: totals.balance < 0 ? 'Credit' : 'Balance due', value: money(Math.abs(totals.balance)), strong: true, band: true });
    }
    if (doc.type === 'receipt' && doc.paymentNote.trim()) rows.push({ label: 'Paid by', value: fit(m, doc.paymentNote.trim(), 'regular', st.body, 120) });

    const boxW = 236;
    const bx = W - M - boxW;
    const rowH = 19;
    const notesW = bx - M - 24;
    const notes: { head: string; lines: string[] }[] = [];
    if (doc.notes.trim()) notes.push({ head: 'NOTES', lines: wrap(m, doc.notes.trim(), 'regular', st.body, notesW) });
    if (doc.terms.trim()) notes.push({ head: 'TERMS', lines: wrap(m, doc.terms.trim(), 'regular', st.body, notesW) });
    const boxH = rows.reduce((a, r) => a + (r.band ? rowH + 4 : rowH), 0) + 12;
    const notesH = notes.reduce((a, n) => a + 18 + n.lines.length * 12.5 + 8, 0);
    ensure(Math.min(Math.max(boxH, notesH), bottom - M - 60) + 8);
    const top = y;

    if (st.id === 'ledger') rect(bx, top, boxW, boxH, { stroke: INK, lw: 1 });
    let ty = top + 6;
    rows.forEach((r, i) => {
      const band = r.band;
      if (band) {
        if (st.id === 'plain') hline(bx + 8, W - M, ty, INK, 1);
        else rect(bx + (st.id === 'ledger' ? 0 : 0), ty, boxW, rowH + 4, { fill: accent });
      } else if (i > 0 && st.id !== 'plain') hline(bx + 10, bx + boxW - 10, ty, RULE, 0.6);
      const color = band && st.id !== 'plain' ? WHITE : r.strong ? INK : SOFT;
      const font: FontKey = r.strong ? 'bold' : 'regular';
      const size = band ? 11 : st.body;
      const by = ty + (band ? 15.5 : 13);
      text(bx + 10, by, r.label, font, size, band && st.id === 'plain' ? accent : color);
      text(W - M - 10, by, r.value, font, size, band && st.id === 'plain' ? accent : color, 'right');
      ty += band ? rowH + 4 : rowH;
    });

    let ny = top + 4;
    for (const n of notes) {
      text(M, ny + 8, n.head, 'bold', st.small - 0.5, st.id === 'plain' ? SOFT : accent);
      ny += 22;
      for (const l of n.lines) {
        if (ny > bottom) break;
        text(M, ny, l, 'regular', st.body, SOFT);
        ny += 12.5;
      }
      ny += 8;
    }
    y = Math.max(ty + 6, ny) + 18;
  };

  // ---- signatures ----
  const signatures = () => {
    const owner = doc.ownerSign && input.ownerSignature ? input.ownerSignature : null;
    const client = doc.type === 'receipt' ? null : doc.clientSigned;
    const wantsClient = doc.type === 'estimate' || doc.type === 'quote' || client != null;
    if (!owner && !wantsClient) return;
    const h = 92;
    ensure(h);
    const boxW = (CW - 40) / 2;
    const lineY = y + 54;
    const sign = (x: number, strokes: Stroke[] | null, caption: string, sub: string) => {
      if (strokes && strokes.length) {
        const b = strokesBounds(strokes);
        if (b) {
          const s = Math.min((boxW - 20) / Math.max(1, b.width), 46 / Math.max(1, b.height));
          const tx = x + 6 - b.x * s;
          const ty = lineY + 4 - (b.y + b.height) * s;
          for (const st2 of strokes) ops.push({ k: 'path', d: strokePath(st2), tx, ty, s, color: SIGN_INK });
        }
      }
      hline(x, x + boxW, lineY, INK, 0.75);
      text(x, lineY + 13, caption, 'regular', st.small, SOFT);
      if (sub) text(x, lineY + 25, fit(m, sub, 'regular', st.small, boxW), 'regular', st.small, FAINT);
    };
    sign(M, owner?.strokes ?? null, business.name.trim() ? `For ${fit(m, business.name.trim(), 'regular', st.small, boxW - 30)}` : 'Business signature', '');
    if (wantsClient) {
      const cap = doc.type === 'invoice' ? 'Client signature' : 'Accepted by';
      const sub = client ? [client.name, client.at ? date(isoDay(client.at)) : ''].filter(Boolean).join(', ') : doc.client.name ? `${doc.client.name}, date` : 'Name and date';
      sign(M + boxW + 40, client?.strokes ?? null, cap, sub);
    }
    y += h;
  };

  // ---- run ----
  newPage();
  y = header();
  party();
  lineRows();
  totalsBlock();
  signatures();

  // Footers: the number and page count, on every page.
  pages.forEach((p, i) => {
    ops = p.ops;
    const fy = H - M + 8;
    text(M, fy, fit(m, [business.name.trim(), business.phone.trim()].filter(Boolean).join('   '), 'regular', st.small - 0.5, CW / 2), 'regular', st.small - 0.5, FAINT);
    text(W - M, fy, `${doc.number}   Page ${i + 1} of ${pages.length}`, 'regular', st.small - 0.5, FAINT, 'right');
  });
  return pages;
}
