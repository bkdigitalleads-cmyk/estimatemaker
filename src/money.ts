/**
 * The totals math, as pure functions checked by `npm test`. Nothing else in
 * the app adds up money.
 *
 * Money is integers in minor units at a fixed scale of 100 (cents, pence,
 * centimes; 1500 yen is 150000). Quantities are plain numbers (1.5 hours).
 * Every amount is rounded half away from zero to the currency's smallest
 * step (`step`, in minor units: 1 for two-decimal currencies, 100 for yen),
 * at the same points a person doing it on paper would round: each line,
 * the discount, the tax.
 *
 *   line amount   = qty x rate
 *   subtotal      = sum of line amounts
 *   discount      = percent of the subtotal, or a fixed amount (never more than the subtotal)
 *   tax           = tax % of the taxable lines, after their share of the discount
 *   total         = subtotal - discount + tax
 *   balance due   = total - paid (paid is a deposit or what was paid; below 0 means a credit)
 */

export type DiscountKind = 'percent' | 'amount';

export interface LineLike {
  qty: number;
  /** Price per unit, minor units. */
  rate: number;
  /** This line carries the tax. */
  taxable: boolean;
}

export interface TotalsInput {
  lines: LineLike[];
  discountKind: DiscountKind;
  /** A percent (10 = 10%) or minor units, by discountKind. */
  discountValue: number;
  /** Percent, 8.25 = 8.25%. */
  taxRate: number;
  /** Deposit or amount paid, minor units. */
  paid: number;
  /** The smallest amount the currency uses, in minor units (1, or 100 for currencies with no decimals). */
  step?: number;
}

export interface Totals {
  lineAmounts: number[];
  subtotal: number;
  discount: number;
  /** What the tax was worked out on. */
  taxableBase: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
}

const finite = (n: number, d = 0) => (Number.isFinite(n) ? n : d);

/** Half away from zero, after trimming floating-point dust (1.1 x 1005 = 1105.5000000000002). */
export function roundHalf(x: number): number {
  const v = Math.round(finite(x) * 1e6) / 1e6;
  const r = Math.sign(v) * Math.round(Math.abs(v));
  return r === 0 ? 0 : r;
}

/** Rounds minor units to the currency's step. */
export function roundStep(x: number, step = 1): number {
  const s = step > 0 ? step : 1;
  return roundHalf(finite(x) / s) * s;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, finite(n, lo)));
}

export function lineAmount(l: LineLike, step = 1): number {
  return roundStep(finite(l.qty) * finite(l.rate), step);
}

export function computeTotals(input: TotalsInput): Totals {
  const step = input.step ?? 1;
  const lineAmounts = input.lines.map((l) => lineAmount(l, step));
  const subtotal = lineAmounts.reduce((a, b) => a + b, 0);
  const positive = Math.max(0, subtotal);

  let discount = 0;
  if (input.discountKind === 'percent') discount = roundStep((positive * clamp(input.discountValue, 0, 100)) / 100, step);
  else discount = roundStep(clamp(input.discountValue, 0, positive), step);

  const taxableSubtotal = lineAmounts.reduce((a, amt, i) => a + (input.lines[i].taxable ? amt : 0), 0);
  // The discount comes off every line in proportion, so the taxable lines carry their share of it.
  const taxableShare = subtotal > 0 ? roundStep((discount * taxableSubtotal) / subtotal, step) : 0;
  const taxableBase = Math.max(0, taxableSubtotal - taxableShare);
  const tax = roundStep((taxableBase * clamp(input.taxRate, 0, 100)) / 100, step);

  const total = subtotal - discount + tax;
  const paid = Math.max(0, roundStep(input.paid, step));
  return { lineAmounts, subtotal, discount, taxableBase, tax, total, paid, balance: total - paid };
}

/**
 * Reads an amount someone typed ("1,250.50", "1.250,50", "$ 80", "-15")
 * into minor units, using the locale's decimal mark. Null when it is not a
 * number. Grouping marks and currency signs are ignored.
 */
export function parseAmount(text: string, decimalMark = '.'): number | null {
  const n = parseNumber(text, decimalMark);
  return n == null ? null : roundHalf(n * 100);
}

/** Reads a plain number (a quantity, a percent) the same way. */
export function parseNumber(text: string, decimalMark = '.'): number | null {
  let s = String(text ?? '').trim();
  if (!s) return null;
  const neg = /^[^\d]*[-\u2212(]/.test(s);
  const other = decimalMark === ',' ? '.' : ',';
  s = s.replace(/[^\d.,]/g, '');
  // A lone "other" mark followed by exactly 1 or 2 digits reads as a decimal mark too ("12.5" on a comma phone).
  const parts = s.split(other);
  if (parts.length === 2 && !s.includes(decimalMark) && parts[1].length > 0 && parts[1].length <= 2) s = parts.join(decimalMark);
  else s = s.split(other).join('');
  const bits = s.split(decimalMark);
  if (bits.length > 2) return null;
  const v = Number(bits.length === 2 ? `${bits[0] || '0'}.${bits[1] || '0'}` : bits[0]);
  if (!Number.isFinite(v) || bits.join('') === '') return null;
  return neg ? -v : v;
}
