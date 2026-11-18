/**
 * Sample content for the onboarding screens, the design renders and the
 * PDF samples: a made-up one-person carpentry business and plain people's
 * names. No store, brand or bank is named or imitated, and the app never
 * prints this on a person's own documents. Pure data.
 */
import type { Doc } from './model.ts';
import type { Business } from './settings.ts';
import { docTotals } from './docs.ts';

export const SAMPLE_BUSINESS: Business = {
  name: 'Okafor Carpentry',
  address: '1200 Example Avenue\nSpringfield, OR 97477',
  phone: '(541) 555-0142',
  email: 'hello@okafor-carpentry.example',
  website: '',
  taxId: 'License CCB 000000',
};

export function sampleDoc(type: Doc['type'], over: Partial<Doc> = {}): Doc {
  const d = baseDoc(type, over);
  // A receipt is for the whole amount unless the sample says otherwise.
  return type === 'receipt' && over.paid == null ? { ...d, paid: docTotals(d).total } : d;
}

function baseDoc(type: Doc['type'], over: Partial<Doc>): Doc {
  return {
    id: 'sample',
    type,
    number: type === 'estimate' ? 'EST-0042' : type === 'quote' ? 'QUO-0007' : type === 'invoice' ? 'INV-0118' : 'REC-0093',
    status: type === 'receipt' ? 'paid' : 'sent',
    clientId: null,
    client: { name: 'Dana Ruiz', email: 'dana.ruiz@example.com', phone: '(541) 555-0187', address: '48 Alder Street\nEugene, OR 97401' },
    issueDate: '2026-11-17',
    dueDate: type === 'invoice' ? '2026-12-01' : type === 'receipt' ? null : '2026-12-17',
    currency: 'USD',
    lines: [
      { id: 'a', description: 'Rebuild back deck stairs: remove old treads and stringers, set new footings', qty: 1, unit: 'job', rate: 148000, taxable: false },
      { id: 'b', description: 'Pressure-treated lumber, 2x12 and 5/4 decking', qty: 14, unit: 'pc', rate: 3850, taxable: true },
      { id: 'c', description: 'Stainless deck screws and joist hangers', qty: 1, unit: 'box', rate: 8900, taxable: true },
      { id: 'd', description: 'Labor, handrail and balusters', qty: 6.5, unit: 'hr', rate: 7500, taxable: false },
    ],
    discountKind: 'percent',
    discountValue: 5,
    taxRate: 8.25,
    taxLabel: 'Tax',
    paid: type === 'receipt' ? 0 : type === 'invoice' ? 50000 : 0,
    paymentNote: type === 'receipt' ? 'Check 2214' : '',
    notes: type === 'receipt' ? 'Thank you. Your one-year workmanship warranty starts today.' : 'Old lumber hauled away. Two days on site, weather permitting.',
    terms: type === 'invoice' ? 'Payment due within 14 days. Checks to Okafor Carpentry.' : type === 'receipt' ? '' : 'Valid for 30 days. 25% deposit to schedule.',
    ownerSign: true,
    clientSigned: null,
    sourceId: null,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}
