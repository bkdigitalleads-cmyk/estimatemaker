/**
 * Help for filling in a line, and which signature a preview page carries.
 * Pure, checked by `npm test`.
 */
import { formatNumber } from './format.ts';
import type { OwnerSignature } from './settings.ts';
import type { Stroke } from './stroke.ts';

/** One-tap units beside the Unit field. Anything else can still be typed. */
export const UNIT_CHOICES = ['hr', 'job', 'pc', 'day', 'ft', 'each'];

/** How the line reads on the page, before the amount: "2 hr × $75.00" (or "1 × $75.00" with no unit). */
export function lineExample(qty: number, unit: string, rateText: string, locale: string): string {
  const u = unit.trim();
  return `${formatNumber(qty, locale)}${u ? ` ${u}` : ''} × ${rateText}`;
}

/** A number typed into Unit ("2 hr") almost always belongs in Quantity. */
export function unitHasNumber(unit: string): boolean {
  return /\d/.test(unit);
}

/**
 * The owner signature on a preview page. The made-up sample pages carry the
 * sample signature; a page built from the person's own business and
 * document carries only the signature they saved, or none.
 */
export function previewSignature(source: 'sample' | 'own', saved: OwnerSignature | null, sample: Stroke[]): OwnerSignature | null {
  if (source === 'sample') return { strokes: sample, width: 361, height: 232 };
  return saved && saved.strokes.length > 0 ? saved : null;
}
