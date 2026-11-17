/**
 * What is free and what is Pro, as pure functions checked by `npm test`.
 *
 * Free forever: any number of drafts, clients and saved items, editing,
 * converting, duplicating, signing and the on-screen preview. The first
 * two documents exported as PDF (shared, mailed or printed) are free and
 * clean. After that, exporting a new document needs Pro.
 *
 * Nobody is locked out of what they already made: a document that went
 * out free once can always go out again, every document stays readable
 * and editable, and nothing is ever deleted or hidden when Pro ends.
 */

/** How many documents can go out as PDF without Pro. */
export const FREE_EXPORTS = 2;

/** The documents that went out free, by id. */
export type FreeExports = string[];

export interface ExportDecision {
  /** The PDF can go out now. */
  allowed: boolean;
  /** Going out now uses one of the free exports. */
  usesFree: boolean;
}

export function exportDecision(isPro: boolean, freeExports: FreeExports, docId: string): ExportDecision {
  if (isPro) return { allowed: true, usesFree: false };
  if (freeExports.includes(docId)) return { allowed: true, usesFree: false };
  if (freeExports.length < FREE_EXPORTS) return { allowed: true, usesFree: true };
  return { allowed: false, usesFree: false };
}

/** Free exports left, for the line under the export buttons. */
export function freeExportsLeft(isPro: boolean, freeExports: FreeExports): number | null {
  if (isPro) return null;
  return Math.max(0, FREE_EXPORTS - freeExports.length);
}

/** Records a free export once (sharing the same document twice counts once). */
export function recordFreeExport(freeExports: FreeExports, docId: string): FreeExports {
  return freeExports.includes(docId) ? freeExports : [...freeExports, docId];
}

/** The stored list, cleaned: strings only, no repeats. Bad data counts as none used. */
export function parseFreeExports(json: string | null): FreeExports {
  try {
    const v = JSON.parse(json ?? '[]');
    if (!Array.isArray(v)) return [];
    return [...new Set(v.filter((x) => typeof x === 'string' && x.length > 0))];
  } catch {
    return [];
  }
}

/** Making, editing, converting, duplicating, signing and previewing never wait on Pro. */
export function canEdit(_isPro: boolean): true {
  return true;
}

/** Why the in-app paywall opened. */
export type PaywallReason = 'export' | 'pro';
