/**
 * Document numbers: each type has its own prefix and its own sequence
 * (EST-0001, QUO-0001, INV-0001, REC-0001). Pure, checked by `npm test`.
 */
import type { DocType } from './model.ts';

export interface Counter {
  prefix: string;
  /** The number the next document of this type gets. */
  next: number;
}

export const DEFAULT_COUNTERS: Record<DocType, Counter> = {
  estimate: { prefix: 'EST-', next: 1 },
  quote: { prefix: 'QUO-', next: 1 },
  invoice: { prefix: 'INV-', next: 1 },
  receipt: { prefix: 'REC-', next: 1 },
};

/** Numbers are padded to this many digits; bigger ones simply grow. */
export const PAD = 4;

export function formatNumber(prefix: string, n: number, pad = PAD): string {
  return `${cleanPrefix(prefix)}${String(Math.max(0, Math.floor(n))).padStart(pad, '0')}`;
}

/** Prefixes are short and printable: up to 8 characters, no line breaks. */
export function cleanPrefix(prefix: string): string {
  return String(prefix ?? '').replace(/[\r\n\t]+/g, ' ').slice(0, 8);
}

/** A next number someone typed: a whole number from 1 up, or the old one. */
export function cleanNext(n: unknown, fallback = 1): number {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v >= 1 && v < 1e9 ? v : fallback;
}

/** Takes the next number: the formatted number and the counter moved on by one. */
export function take(c: Counter): { number: string; counter: Counter } {
  return { number: formatNumber(c.prefix, c.next), counter: { prefix: c.prefix, next: c.next + 1 } };
}

/**
 * When someone types a number by hand that is ahead of the sequence
 * ("INV-0120" while the counter is at 37), the counter moves past it, so
 * the next one never repeats it. A number with another prefix is ignored.
 */
export function bumpPast(c: Counter, typed: string): Counter {
  const p = cleanPrefix(c.prefix);
  if (!typed.startsWith(p)) return c;
  const rest = typed.slice(p.length);
  if (!/^\d+$/.test(rest)) return c;
  const n = Number(rest);
  return n >= c.next ? { prefix: c.prefix, next: n + 1 } : c;
}
