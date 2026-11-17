/** Local calendar dates as "YYYY-MM-DD", pure and checked by `npm test`. */

export function isoDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Noon local on that day, so adding days never trips over a clock change. */
export function dayMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12).getTime();
}

export function addDays(iso: string, n: number): string {
  const t = new Date(dayMs(iso));
  t.setDate(t.getDate() + n);
  return isoDay(t.getTime());
}

export function daysBetween(a: string, b: string): number {
  return Math.round((dayMs(b) - dayMs(a)) / 86_400_000);
}

export function isIsoDay(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && isoDay(dayMs(s)) === s;
}

/** "2026-11" for grouping by month. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}
