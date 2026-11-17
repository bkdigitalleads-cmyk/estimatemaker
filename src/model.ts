/**
 * The one document model: four types share every field. Pure types and
 * rules, no React or native imports, checked by `npm test`.
 */
import type { DiscountKind } from './money.ts';
import type { Stroke } from './stroke.ts';

export type DocType = 'estimate' | 'quote' | 'invoice' | 'receipt';
export const DOC_TYPES: DocType[] = ['estimate', 'quote', 'invoice', 'receipt'];

export type Status = 'draft' | 'sent' | 'accepted' | 'paid';
export const STATUSES: Status[] = ['draft', 'sent', 'accepted', 'paid'];

export const TYPE_LABEL: Record<DocType, string> = { estimate: 'Estimate', quote: 'Quote', invoice: 'Invoice', receipt: 'Receipt' };
export const TYPE_PLURAL: Record<DocType, string> = { estimate: 'Estimates', quote: 'Quotes', invoice: 'Invoices', receipt: 'Receipts' };
export const STATUS_LABEL: Record<Status, string> = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', paid: 'Paid' };

export interface Line {
  id: string;
  description: string;
  qty: number;
  /** "hr", "ea", "sq ft"; printed after the quantity. */
  unit: string;
  /** Per unit, minor units. */
  rate: number;
  taxable: boolean;
}

export interface ClientSnap {
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface Signed {
  strokes: Stroke[];
  /** The pad it was drawn on, so it can be fitted onto the page. */
  width: number;
  height: number;
  name: string;
  /** When it was signed, ms. */
  at: number;
}

export interface Doc {
  id: string;
  type: DocType;
  number: string;
  status: Status;
  clientId: string | null;
  client: ClientSnap;
  /** YYYY-MM-DD, local. */
  issueDate: string;
  /** Due date for invoices, "valid until" for estimates and quotes; none for receipts. */
  dueDate: string | null;
  currency: string;
  lines: Line[];
  discountKind: DiscountKind;
  discountValue: number;
  taxRate: number;
  /** "Tax", "VAT", "GST", "HST". */
  taxLabel: string;
  /** Deposit (estimates and quotes) or amount paid (invoices and receipts), minor units. */
  paid: number;
  /** How it was paid, for receipts ("Card", "Check 1042"). */
  paymentNote: string;
  notes: string;
  terms: string;
  /** Print the owner's saved signature on the business line. */
  ownerSign: boolean;
  clientSigned: Signed | null;
  /** The document this one was made from (an estimate's invoice, an invoice's receipt). */
  sourceId: string | null;
  createdAt: number;
  updatedAt: number;
}

/** The status choices that make sense for a type. A receipt is always paid. */
export function statusesFor(type: DocType): Status[] {
  if (type === 'receipt') return ['paid'];
  if (type === 'invoice') return ['draft', 'sent', 'paid'];
  return ['draft', 'sent', 'accepted'];
}

/** What a document can turn into with one tap. */
export function convertTargets(type: DocType): DocType[] {
  if (type === 'estimate' || type === 'quote') return ['invoice'];
  if (type === 'invoice') return ['receipt'];
  return [];
}

/** The label of the second date. */
export function dueLabel(type: DocType): string | null {
  if (type === 'invoice') return 'Due';
  if (type === 'estimate' || type === 'quote') return 'Valid until';
  return null;
}

/** The label of the paid line. */
export function paidLabel(type: DocType): string {
  return type === 'estimate' || type === 'quote' ? 'Deposit' : 'Paid';
}

export const EMPTY_CLIENT: ClientSnap = { name: '', email: '', phone: '', address: '' };

export function newId(now: number, rand: () => number = Math.random): string {
  return `${now.toString(36)}${Math.floor(rand() * 36 ** 6)
    .toString(36)
    .padStart(6, '0')}`;
}

export function blankLine(id: string): Line {
  return { id, description: '', qty: 1, unit: '', rate: 0, taxable: true };
}
