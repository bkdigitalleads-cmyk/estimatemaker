/**
 * The business profile and the defaults new documents start from. Pure
 * parsing with fallbacks, so a damaged row never stops the app.
 */
import type { DocType } from './model.ts';
import type { Stroke } from './stroke.ts';

export interface Business {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  /** Printed as typed: "License #448812", "VAT GB123456789", "ABN 51 824 753 556". */
  taxId: string;
}

export interface Logo {
  /** PNG, base64. */
  base64: string;
  width: number;
  height: number;
}

export interface OwnerSignature {
  strokes: Stroke[];
  width: number;
  height: number;
}

export type TemplateId = 'ledger' | 'banner' | 'plain';
export type Paper = 'letter' | 'a4';

export interface Defaults {
  currency: string;
  taxRate: number;
  taxLabel: string;
  /** Days from the issue date to the due date on invoices. */
  dueDays: number;
  /** Days an estimate or quote stays valid. */
  validDays: number;
  template: TemplateId;
  accent: string;
  paper: Paper;
  notes: Record<DocType, string>;
  terms: Record<DocType, string>;
}

export const EMPTY_BUSINESS: Business = { name: '', address: '', phone: '', email: '', website: '', taxId: '' };

export const TEMPLATES: { id: TemplateId; label: string; line: string }[] = [
  { id: 'ledger', label: 'Ledger', line: 'Ruled lines and a boxed total' },
  { id: 'banner', label: 'Banner', line: 'A band of color across the top' },
  { id: 'plain', label: 'Plain', line: 'Quiet, with plenty of white space' },
];

/** The accent colors on offer: dark enough for white text and for print. */
export const ACCENTS: { hex: string; label: string }[] = [
  { hex: '#1F3A5F', label: 'Navy' },
  { hex: '#2F5D46', label: 'Green' },
  { hex: '#8A3324', label: 'Brick' },
  { hex: '#B5651D', label: 'Copper' },
  { hex: '#4B3F72', label: 'Plum' },
  { hex: '#2B2B2B', label: 'Graphite' },
];

/** Countries that print on US Letter; everyone else gets A4. */
const LETTER_REGIONS = ['US', 'CA', 'MX', 'PH', 'CL', 'CO', 'VE', 'GT', 'PR', 'DO', 'CR', 'PA', 'SV', 'NI', 'HN', 'BZ'];

export function paperFor(region: string | null | undefined): Paper {
  return region && LETTER_REGIONS.includes(region.toUpperCase()) ? 'letter' : 'a4';
}

export function taxLabelFor(region: string | null | undefined): string {
  const r = (region ?? '').toUpperCase();
  if (r === 'AU' || r === 'NZ' || r === 'IN' || r === 'SG') return 'GST';
  if (r === 'CA') return 'Tax';
  if (r === 'US' || r === '') return 'Tax';
  return 'VAT';
}

export function defaultDefaults(currency: string, region: string | null | undefined): Defaults {
  return {
    currency: /^[A-Z]{3}$/.test(currency) ? currency : 'USD',
    taxRate: 0,
    taxLabel: taxLabelFor(region),
    dueDays: 14,
    validDays: 30,
    template: 'ledger',
    accent: ACCENTS[0].hex,
    paper: paperFor(region),
    notes: { estimate: '', quote: '', invoice: '', receipt: '' },
    terms: {
      estimate: 'This estimate is valid for 30 days. Work starts once it is accepted.',
      quote: 'This quote is valid for 30 days.',
      invoice: 'Payment is due by the date above.',
      receipt: 'Thank you for your business.',
    },
  };
}

const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');

export function parseBusiness(json: string | null): Business {
  try {
    const v = JSON.parse(json ?? '{}') ?? {};
    return { name: str(v.name, 120), address: str(v.address, 400), phone: str(v.phone, 60), email: str(v.email, 120), website: str(v.website, 120), taxId: str(v.taxId, 120) };
  } catch {
    return { ...EMPTY_BUSINESS };
  }
}

export function parseDefaults(json: string | null, fallback: Defaults): Defaults {
  try {
    const v = JSON.parse(json ?? '{}') ?? {};
    const num = (x: unknown, d: number, lo: number, hi: number) => (typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi ? x : d);
    const rec = (x: unknown, d: Record<DocType, string>) => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      return { estimate: typeof o.estimate === 'string' ? o.estimate : d.estimate, quote: typeof o.quote === 'string' ? o.quote : d.quote, invoice: typeof o.invoice === 'string' ? o.invoice : d.invoice, receipt: typeof o.receipt === 'string' ? o.receipt : d.receipt };
    };
    return {
      currency: typeof v.currency === 'string' && /^[A-Z]{3}$/.test(v.currency) ? v.currency : fallback.currency,
      taxRate: num(v.taxRate, fallback.taxRate, 0, 100),
      taxLabel: typeof v.taxLabel === 'string' && v.taxLabel.trim() ? v.taxLabel.slice(0, 12) : fallback.taxLabel,
      dueDays: num(v.dueDays, fallback.dueDays, 0, 365),
      validDays: num(v.validDays, fallback.validDays, 0, 365),
      template: TEMPLATES.some((t) => t.id === v.template) ? v.template : fallback.template,
      accent: ACCENTS.some((a) => a.hex === v.accent) ? v.accent : fallback.accent,
      paper: v.paper === 'letter' || v.paper === 'a4' ? v.paper : fallback.paper,
      notes: rec(v.notes, fallback.notes),
      terms: rec(v.terms, fallback.terms),
    };
  } catch {
    return fallback;
  }
}

export function parseLogo(json: string | null): Logo | null {
  try {
    const v = JSON.parse(json ?? 'null');
    if (!v || typeof v.base64 !== 'string' || !(v.width > 0) || !(v.height > 0)) return null;
    return { base64: v.base64, width: v.width, height: v.height };
  } catch {
    return null;
  }
}

export function parseOwnerSignature(json: string | null): OwnerSignature | null {
  try {
    const v = JSON.parse(json ?? 'null');
    if (!v || !Array.isArray(v.strokes) || v.strokes.length === 0 || !(v.width > 0) || !(v.height > 0)) return null;
    return { strokes: v.strokes, width: v.width, height: v.height };
  } catch {
    return null;
  }
}
