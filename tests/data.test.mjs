// Unit checks for the data layer: totals, tax, discount and the rounding
// points; numbering; the migrations and every read and write on a real
// SQLite (Node's built-in node:sqlite runs the same SQL as expo-sqlite);
// converting, duplicating, filtering and the home numbers; reading typed
// amounts and showing money in the phone's own format.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

const M = await import('../src/money.ts');
const N = await import('../src/numbering.ts');
const D = await import('../src/docs.ts');
const MO = await import('../src/model.ts');
const ST = await import('../src/settings.ts');
const SC = await import('../src/db/schema.ts');
const R = await import('../src/db/repo.ts');
const F = await import('../src/format.ts');
const DT = await import('../src/dates.ts');

const L = (qty, rate, taxable = true) => ({ qty, rate, taxable });

// ---------- totals ----------

test('totals: lines are qty x rate, rounded per line; subtotal is their sum', () => {
  const t = M.computeTotals({ lines: [L(2, 4500), L(1.5, 8000), L(3, 333)], discountKind: 'percent', discountValue: 0, taxRate: 0, paid: 0 });
  assert.deepEqual(t.lineAmounts, [9000, 12000, 999]);
  assert.equal(t.subtotal, 21999);
  assert.equal(t.total, 21999);
  assert.equal(t.balance, 21999);
  // Half away from zero, and no floating-point dust: 1.1 x 1005 is 1105.5, which rounds up.
  assert.equal(M.lineAmount(L(1.1, 1005)), 1106);
  assert.equal(M.lineAmount(L(0.5, 1)), 1);
  assert.equal(M.lineAmount(L(-0.5, 1)), -1);
  assert.equal(M.lineAmount(L(0.333, 300)), 100);
});

test('tax: only on taxable lines; a rate like 8.25% rounds to the cent', () => {
  const t = M.computeTotals({ lines: [L(1, 10000), L(1, 5000, false)], discountKind: 'percent', discountValue: 0, taxRate: 8.25, paid: 0 });
  assert.equal(t.taxableBase, 10000);
  assert.equal(t.tax, 825);
  assert.equal(t.total, 15825);
  const odd = M.computeTotals({ lines: [L(1, 1999)], discountKind: 'percent', discountValue: 0, taxRate: 7.5, paid: 0 });
  assert.equal(odd.tax, 150); // 149.925
  const none = M.computeTotals({ lines: [L(1, 1999, false)], discountKind: 'percent', discountValue: 0, taxRate: 20, paid: 0 });
  assert.equal(none.tax, 0);
  // Out-of-range rates are clamped.
  assert.equal(M.computeTotals({ lines: [L(1, 1000)], discountKind: 'percent', discountValue: 0, taxRate: 250, paid: 0 }).tax, 1000);
  assert.equal(M.computeTotals({ lines: [L(1, 1000)], discountKind: 'percent', discountValue: 0, taxRate: -5, paid: 0 }).tax, 0);
});

test('discount: percent or amount, never more than the subtotal; taxable lines carry their share of it', () => {
  const pct = M.computeTotals({ lines: [L(1, 20000)], discountKind: 'percent', discountValue: 10, taxRate: 10, paid: 0 });
  assert.equal(pct.discount, 2000);
  assert.equal(pct.taxableBase, 18000);
  assert.equal(pct.tax, 1800);
  assert.equal(pct.total, 19800);
  const amt = M.computeTotals({ lines: [L(1, 30000), L(1, 10000, false)], discountKind: 'amount', discountValue: 4000, taxRate: 10, paid: 0 });
  assert.equal(amt.discount, 4000);
  // 3/4 of the discount falls on the taxable line.
  assert.equal(amt.taxableBase, 27000);
  assert.equal(amt.tax, 2700);
  assert.equal(amt.total, 40000 - 4000 + 2700);
  const over = M.computeTotals({ lines: [L(1, 5000)], discountKind: 'amount', discountValue: 999999, taxRate: 10, paid: 0 });
  assert.equal(over.discount, 5000);
  assert.equal(over.total, 0);
  assert.equal(M.computeTotals({ lines: [L(1, 5000)], discountKind: 'percent', discountValue: 150, taxRate: 0, paid: 0 }).discount, 5000);
  assert.equal(M.computeTotals({ lines: [L(1, 5000)], discountKind: 'percent', discountValue: -10, taxRate: 0, paid: 0 }).discount, 0);
});

test('deposit and paid: the balance is what is left; overpaying shows as a credit; no lines is all zero', () => {
  const t = M.computeTotals({ lines: [L(1, 100000)], discountKind: 'percent', discountValue: 0, taxRate: 0, paid: 25000 });
  assert.equal(t.paid, 25000);
  assert.equal(t.balance, 75000);
  assert.equal(M.computeTotals({ lines: [L(1, 1000)], discountKind: 'percent', discountValue: 0, taxRate: 0, paid: 1500 }).balance, -500);
  assert.equal(M.computeTotals({ lines: [L(1, 1000)], discountKind: 'percent', discountValue: 0, taxRate: 0, paid: -50 }).paid, 0);
  const empty = M.computeTotals({ lines: [], discountKind: 'percent', discountValue: 10, taxRate: 10, paid: 0 });
  assert.deepEqual([empty.subtotal, empty.discount, empty.tax, empty.total], [0, 0, 0, 0]);
  const junk = M.computeTotals({ lines: [L(NaN, 100), L(2, Infinity)], discountKind: 'percent', discountValue: NaN, taxRate: NaN, paid: NaN });
  assert.ok(Object.values(junk).flat().every(Number.isFinite));
});

test('currencies with no decimals: every amount rounds to a whole unit', () => {
  // 1,234 yen is 123400 minor units at the app's fixed scale.
  const t = D.docTotals({ lines: [{ id: 'a', description: '', unit: '', qty: 1.5, rate: 123400, taxable: true }], discountKind: 'percent', discountValue: 0, taxRate: 10, paid: 0, currency: 'JPY' });
  assert.equal(t.lineAmounts[0], 185100);
  assert.equal(t.tax, 18500); // 10% of 1,851 yen is 185.1, rounded to 185 yen
  assert.equal(t.total % 100, 0);
  assert.equal(D.stepFor('USD'), 1);
  assert.equal(D.stepFor('KRW'), 100);
});

test('typed amounts: either decimal mark, grouping and symbols ignored, minor units out', () => {
  assert.equal(M.parseAmount('1,250.50', '.'), 125050);
  assert.equal(M.parseAmount('1.250,50', ','), 125050);
  assert.equal(M.parseAmount('$ 80', '.'), 8000);
  assert.equal(M.parseAmount('12.5', ','), 1250, 'a dot with one or two digits after it reads as decimals on a comma phone');
  assert.equal(M.parseAmount('1.250', ','), 125000, 'three digits after a dot is grouping');
  assert.equal(M.parseAmount('-15', '.'), -1500);
  assert.equal(M.parseAmount('', '.'), null);
  assert.equal(M.parseAmount('abc', '.'), null);
  assert.equal(M.parseAmount('1.2.3', '.'), null);
  assert.equal(M.parseNumber('1,5', ','), 1.5);
  assert.equal(M.parseNumber('2', '.'), 2);
  assert.equal(M.parseNumber('.5', '.'), 0.5);
});

// ---------- numbering ----------

test('numbering: each type has its own prefix and sequence, padded to four digits', () => {
  assert.equal(N.formatNumber('EST-', 1), 'EST-0001');
  assert.equal(N.formatNumber('INV-', 12345), 'INV-12345');
  assert.equal(N.formatNumber('', 7), '0007');
  const a = N.take(N.DEFAULT_COUNTERS.invoice);
  assert.equal(a.number, 'INV-0001');
  assert.equal(a.counter.next, 2);
  assert.equal(N.take(a.counter).number, 'INV-0002');
  assert.deepEqual(Object.values(N.DEFAULT_COUNTERS).map((c) => c.prefix), ['EST-', 'QUO-', 'INV-', 'REC-']);
  assert.equal(N.cleanPrefix('A VERY LONG PREFIX\n'), 'A VERY L');
  assert.equal(N.cleanNext('42'), 42);
  assert.equal(N.cleanNext(0, 5), 5);
  assert.equal(N.cleanNext('x', 3), 3);
});

test('numbering: a number typed ahead of the sequence moves the counter past it; behind or foreign ones do not', () => {
  const c = { prefix: 'INV-', next: 37 };
  assert.deepEqual(N.bumpPast(c, 'INV-0120'), { prefix: 'INV-', next: 121 });
  assert.equal(N.bumpPast(c, 'INV-0010'), c);
  assert.equal(N.bumpPast(c, 'EST-0500'), c);
  assert.equal(N.bumpPast(c, 'INV-12A'), c);
});

// ---------- the database ----------

function nodeDb() {
  const sq = new DatabaseSync(':memory:');
  const norm = (p) => p.map((v) => (v === undefined ? null : v));
  return {
    sq,
    db: {
      exec: async (sql) => sq.exec(sql),
      run: async (sql, p = []) => {
        sq.prepare(sql).run(...norm(p));
      },
      all: async (sql, p = []) => sq.prepare(sql).all(...norm(p)).map((r) => ({ ...r })),
      get: async (sql, p = []) => {
        const r = sq.prepare(sql).get(...norm(p));
        return r ? { ...r } : null;
      },
      tx: async (fn) => {
        sq.exec('BEGIN');
        try {
          await fn();
          sq.exec('COMMIT');
        } catch (e) {
          sq.exec('ROLLBACK');
          throw e;
        }
      },
    },
  };
}

const DEFAULTS = ST.defaultDefaults('USD', 'US');
const TODAY = '2026-11-17';

async function freshDb() {
  const { db, sq } = nodeDb();
  await SC.migrate(db);
  return { db, sq };
}

let seq = 0;
const nid = () => `id${++seq}`;

async function newDoc(db, type, patch = {}) {
  return R.createDoc(db, type, (number) => ({ ...D.makeDoc({ id: nid(), lineId: nid(), type, number, today: TODAY, now: 1000 + seq, defaults: DEFAULTS }), ...patch }));
}

test('migrations: a new database gets every table; running again changes nothing; a newer database is refused', async () => {
  const { db, sq } = nodeDb();
  assert.equal(await SC.migrate(db), SC.MIGRATIONS.length);
  const tables = sq.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((r) => r.name);
  assert.deepEqual(tables, ['clients', 'counters', 'docs', 'items', 'kv', 'lines']);
  assert.equal(await SC.migrate(db), SC.MIGRATIONS.length);
  assert.equal(sq.prepare('PRAGMA user_version').get().user_version, SC.MIGRATIONS.length);
  sq.exec(`PRAGMA user_version = ${SC.MIGRATIONS.length + 1}`);
  await assert.rejects(SC.migrate(db), /newer version/);
});

test('migrations: a failed step leaves the database as it was', async () => {
  const { db, sq } = nodeDb();
  const saved = SC.MIGRATIONS.slice();
  SC.MIGRATIONS.push('CREATE TABLE extra (x INTEGER); THIS IS NOT SQL;');
  try {
    await assert.rejects(SC.migrate(db));
    assert.equal(sq.prepare('PRAGMA user_version').get().user_version, saved.length);
    assert.equal(sq.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'extra'").get().n, 0);
  } finally {
    SC.MIGRATIONS.length = 0;
    SC.MIGRATIONS.push(...saved);
  }
});

test('key/value: set, overwrite, read back, delete', async () => {
  const { db } = await freshDb();
  assert.equal(await R.kvGet(db, 'a'), null);
  await R.kvSet(db, 'a', '1');
  await R.kvSet(db, 'a', '2');
  assert.equal(await R.kvGet(db, 'a'), '2');
  await R.kvDelete(db, 'a');
  assert.equal(await R.kvGet(db, 'a'), null);
});

test('documents: each type numbers on its own; save and read back every field with its lines in order', async () => {
  const { db } = await freshDb();
  const e1 = await newDoc(db, 'estimate');
  const e2 = await newDoc(db, 'estimate');
  const i1 = await newDoc(db, 'invoice');
  const q1 = await newDoc(db, 'quote');
  const r1 = await newDoc(db, 'receipt');
  assert.deepEqual([e1.number, e2.number, i1.number, q1.number, r1.number], ['EST-0001', 'EST-0002', 'INV-0001', 'QUO-0001', 'REC-0001']);
  assert.equal(r1.status, 'paid');
  const signed = { strokes: [{ pen: 'ink', size: 1, pts: [[1, 2, 0, 0]] }], width: 300, height: 120, name: 'Dana Ruiz', at: 5 };
  const full = {
    ...e1,
    client: { name: 'Dana Ruiz', email: 'dana@example.com', phone: '555 0100', address: '12 Elm St\nSpringfield' },
    lines: [
      { id: 'l1', description: 'Replace water heater', qty: 1, unit: 'ea', rate: 145000, taxable: true },
      { id: 'l2', description: 'Labor', qty: 3.5, unit: 'hr', rate: 8500, taxable: false },
    ],
    discountKind: 'amount',
    discountValue: 5000,
    taxRate: 8.25,
    paid: 20000,
    notes: 'Old unit hauled away.',
    clientSigned: signed,
    ownerSign: false,
  };
  await R.saveDoc(db, full);
  const back = await R.getDoc(db, e1.id);
  assert.deepEqual(back.lines, full.lines);
  assert.deepEqual(back.client, full.client);
  assert.deepEqual(back.clientSigned, signed);
  assert.equal(back.discountKind, 'amount');
  assert.equal(back.ownerSign, false);
  const rows = await R.listRows(db);
  const row = rows.find((r) => r.id === e1.id);
  const t = D.docTotals(full);
  assert.equal(row.total, t.total);
  assert.equal(row.balance, t.total - 20000);
  // Fewer lines on the next save: the dropped one is gone.
  await R.saveDoc(db, { ...back, lines: back.lines.slice(1) });
  assert.equal((await R.getDoc(db, e1.id)).lines.length, 1);
  await R.deleteDoc(db, e2.id);
  assert.equal(await R.getDoc(db, e2.id), null);
  const n = await newDoc(db, 'estimate');
  assert.equal(n.number, 'EST-0003', 'a deleted number is not reused');
});

test('numbering in the database: prefix and next can be changed; a hand-typed number ahead moves the counter', async () => {
  const { db } = await freshDb();
  await R.setCounter(db, 'invoice', { prefix: 'A-', next: 500 });
  const a = await newDoc(db, 'invoice');
  assert.equal(a.number, 'A-0500');
  await R.saveDoc(db, { ...a, number: 'A-0900' });
  assert.equal((await newDoc(db, 'invoice')).number, 'A-0901');
  assert.equal((await R.getCounters(db)).estimate.prefix, 'EST-');
});

test('convert: estimate to invoice carries every line and marks the estimate accepted; invoice to receipt is paid in full', async () => {
  const { db } = await freshDb();
  const e = await newDoc(db, 'estimate', { lines: [{ id: 'x1', description: 'Deck stain', qty: 2, unit: 'gal', rate: 4500, taxable: true }], taxRate: 10, client: { name: 'Sam Patel', email: '', phone: '', address: '' } });
  const inv = await R.convertAndSave(db, e.id, 'invoice', { today: '2026-11-20', now: 9999, defaults: DEFAULTS });
  assert.equal(inv.type, 'invoice');
  assert.equal(inv.number, 'INV-0001');
  assert.equal(inv.status, 'draft');
  assert.equal(inv.sourceId, e.id);
  assert.equal(inv.issueDate, '2026-11-20');
  assert.equal(inv.dueDate, DT.addDays('2026-11-20', DEFAULTS.dueDays));
  assert.equal(inv.terms, DEFAULTS.terms.invoice);
  assert.deepEqual(inv.lines.map((l) => [l.description, l.qty, l.rate]), [['Deck stain', 2, 4500]]);
  assert.notEqual(inv.lines[0].id, 'x1', 'lines get their own ids');
  assert.equal(inv.client.name, 'Sam Patel');
  assert.equal((await R.getDoc(db, e.id)).status, 'accepted');
  const rec = await R.convertAndSave(db, inv.id, 'receipt', { today: '2026-11-25', now: 10000, defaults: DEFAULTS });
  assert.equal(rec.number, 'REC-0001');
  assert.equal(rec.status, 'paid');
  assert.equal(rec.dueDate, null);
  assert.equal(rec.paid, D.docTotals(inv).total);
  assert.equal(D.docTotals(rec).balance, 0);
  assert.equal((await R.getDoc(db, inv.id)).status, 'paid');
  assert.throws(() => D.convertDoc(rec, 'invoice', { id: 'z', number: 'n', today: TODAY, now: 1, defaults: DEFAULTS, lineIds: [] }), /cannot become/);
  assert.deepEqual(MO.convertTargets('quote'), ['invoice']);
  assert.deepEqual(MO.convertTargets('receipt'), []);
});

test('duplicate: same type, lines and client; next number, today, a draft, no signature, nothing paid', async () => {
  const { db } = await freshDb();
  const sig = { strokes: [], width: 1, height: 1, name: 'x', at: 1 };
  const i = await newDoc(db, 'invoice', { status: 'paid', paid: 500, clientSigned: sig, lines: [{ id: 'q1', description: 'Mow', qty: 1, unit: '', rate: 4000, taxable: false }] });
  const c = await R.duplicateAndSave(db, i.id, { today: '2026-12-01', now: 50, defaults: DEFAULTS });
  assert.equal(c.number, 'INV-0002');
  assert.equal(c.status, 'draft');
  assert.equal(c.paid, 0);
  assert.equal(c.clientSigned, null);
  assert.equal(c.issueDate, '2026-12-01');
  assert.equal(c.lines[0].description, 'Mow');
  assert.equal((await R.getDoc(db, i.id)).status, 'paid', 'the original is untouched');
});

test('statuses: each type has its own; a stored status that does not fit is read as the first', async () => {
  assert.deepEqual(MO.statusesFor('estimate'), ['draft', 'sent', 'accepted']);
  assert.deepEqual(MO.statusesFor('invoice'), ['draft', 'sent', 'paid']);
  assert.deepEqual(MO.statusesFor('receipt'), ['paid']);
  assert.equal(D.fitStatus('estimate', 'paid'), 'draft');
  const { db } = await freshDb();
  const e = await newDoc(db, 'estimate');
  await R.setStatus(db, e.id, 'sent', 2);
  assert.equal((await R.getDoc(db, e.id)).status, 'sent');
  await R.setStatus(db, e.id, 'paid', 3);
  assert.equal((await R.getDoc(db, e.id)).status, 'draft');
});

test('clients and items: saved, sorted by name, edited; drafts follow a client edit, sent documents keep what they printed', async () => {
  const { db } = await freshDb();
  const c = { id: 'c1', name: 'Zoe Hart', email: 'zoe@example.com', phone: '', address: '1 Main St', notes: '', createdAt: 1, updatedAt: 1 };
  await R.saveClient(db, c);
  await R.saveClient(db, { ...c, id: 'c2', name: 'alex Kim' });
  assert.deepEqual((await R.listClients(db)).map((x) => x.name), ['alex Kim', 'Zoe Hart']);
  const draft = await newDoc(db, 'invoice', { clientId: 'c1', client: { name: 'Zoe Hart', email: '', phone: '', address: '1 Main St' } });
  const sent = await newDoc(db, 'invoice', { clientId: 'c1', status: 'sent', client: { name: 'Zoe Hart', email: '', phone: '', address: '1 Main St' } });
  await R.saveClient(db, { ...c, address: '9 New Rd', updatedAt: 2 });
  assert.equal((await R.getDoc(db, draft.id)).client.address, '9 New Rd');
  assert.equal((await R.getDoc(db, sent.id)).client.address, '1 Main St');
  await R.deleteClient(db, 'c1');
  const kept = await R.getDoc(db, sent.id);
  assert.equal(kept.clientId, null);
  assert.equal(kept.client.name, 'Zoe Hart', 'the document keeps the name');

  const it = { id: 'i1', description: 'Service call', rate: 9500, unit: 'ea', taxable: false, createdAt: 1, updatedAt: 1 };
  await R.saveItem(db, it);
  await R.saveItem(db, { ...it, id: 'i2', description: 'Anchor bolts', rate: 125, taxable: true });
  const items = await R.listItems(db);
  assert.deepEqual(items.map((x) => x.description), ['Anchor bolts', 'Service call']);
  assert.equal(items[1].taxable, false);
  await R.saveItem(db, { ...it, rate: 9900 });
  assert.equal((await R.listItems(db)).find((x) => x.id === 'i1').rate, 9900);
  await R.deleteItem(db, 'i2');
  assert.equal((await R.listItems(db)).length, 1);
});

test('a failed save rolls back: no half-written document, the number is not used up', async () => {
  const { db } = await freshDb();
  await assert.rejects(R.createDoc(db, 'invoice', (number) => ({ ...D.makeDoc({ id: 'bad', lineId: 'l', type: 'invoice', number, today: TODAY, now: 1, defaults: DEFAULTS }), issueDate: null })));
  assert.equal(await R.getDoc(db, 'bad'), null);
  assert.equal((await newDoc(db, 'invoice')).number, 'INV-0001');
});

// ---------- filters and the home numbers ----------

const row = (p) => ({ id: p.id, type: 'invoice', number: 'INV-0001', status: 'sent', clientId: null, clientName: '', issueDate: TODAY, dueDate: null, currency: 'USD', total: 0, balance: 0, sourceId: null, updatedAt: 0, ...p });

test('search and filters: by number, client (accents ignored) or amount; by type, status and client; newest first', () => {
  const rows = [
    row({ id: 'a', number: 'INV-0007', clientName: 'José Ortega', total: 125050, issueDate: '2026-11-02' }),
    row({ id: 'b', type: 'estimate', number: 'EST-0003', status: 'accepted', clientName: 'Dana Ruiz', clientId: 'c9', total: 9900, issueDate: '2026-11-10' }),
    row({ id: 'c', type: 'receipt', number: 'REC-0001', status: 'paid', clientName: 'Dana Ruiz', clientId: 'c9', total: 4000, issueDate: '2026-11-10', updatedAt: 5 }),
  ];
  const ids = (f) => D.filterRows(rows, { ...D.NO_FILTER, ...f }).map((r) => r.id);
  assert.deepEqual(ids({}), ['c', 'b', 'a']);
  assert.deepEqual(ids({ query: 'jose' }), ['a']);
  assert.deepEqual(ids({ query: '0007' }), ['a']);
  assert.deepEqual(ids({ query: '1250.5' }), ['a']);
  assert.deepEqual(ids({ query: 'dana', type: 'estimate' }), ['b']);
  assert.deepEqual(ids({ status: 'paid' }), ['c']);
  assert.deepEqual(ids({ clientId: 'c9' }), ['c', 'b']);
  assert.deepEqual(ids({ query: 'nobody' }), []);
});

test('home numbers: billed this month and unpaid, per currency; drafts count in neither; overdue counted', () => {
  const rows = [
    row({ id: '1', status: 'sent', total: 50000, balance: 50000, issueDate: '2026-11-03', dueDate: '2026-11-10' }),
    row({ id: '2', status: 'paid', total: 20000, balance: 0, issueDate: '2026-11-05' }),
    row({ id: '3', status: 'draft', total: 99999, balance: 99999, issueDate: '2026-11-06' }),
    row({ id: '4', status: 'sent', total: 30000, balance: 10000, issueDate: '2026-10-20', dueDate: '2026-12-01' }),
    row({ id: '5', type: 'receipt', status: 'paid', total: 7000, issueDate: '2026-11-08' }),
    row({ id: '6', type: 'receipt', status: 'paid', total: 20000, issueDate: '2026-11-09', sourceId: '2' }),
    row({ id: '7', status: 'sent', total: 10000, balance: 10000, issueDate: '2026-11-11', currency: 'EUR' }),
    row({ id: '8', type: 'estimate', status: 'sent', total: 80000, balance: 80000, issueDate: '2026-11-11' }),
  ];
  const s = D.summarize(rows, TODAY);
  assert.equal(s.month.USD, 50000 + 20000 + 7000, 'the receipt made from invoice 2 is not counted twice');
  assert.equal(s.month.EUR, 10000);
  assert.equal(s.unpaid.USD, 50000 + 10000);
  assert.equal(s.unpaid.EUR, 10000);
  assert.equal(s.unpaidCount, 3);
  assert.equal(s.overdueCount, 1);
  assert.equal(D.isOverdue(rows[0], TODAY), true);
  assert.equal(D.isOverdue(rows[0], '2026-11-10'), false, 'not on the due date itself');
});

test('new documents: today, the due or valid-until date from the defaults, one empty line, the type\'s terms', () => {
  const inv = D.makeDoc({ id: 'a', lineId: 'b', type: 'invoice', number: 'INV-0001', today: TODAY, now: 1, defaults: DEFAULTS });
  assert.equal(inv.dueDate, '2026-12-01');
  assert.equal(inv.lines.length, 1);
  assert.equal(inv.terms, DEFAULTS.terms.invoice);
  assert.equal(inv.currency, 'USD');
  assert.equal(D.makeDoc({ id: 'a', lineId: 'b', type: 'estimate', number: 'x', today: TODAY, now: 1, defaults: DEFAULTS }).dueDate, '2026-12-17');
  assert.equal(D.makeDoc({ id: 'a', lineId: 'b', type: 'receipt', number: 'x', today: TODAY, now: 1, defaults: DEFAULTS }).dueDate, null);
});

// ---------- settings ----------

test('settings: defaults follow the region (Letter or A4, Tax or VAT); damaged rows fall back', () => {
  assert.equal(ST.paperFor('US'), 'letter');
  assert.equal(ST.paperFor('ca'), 'letter');
  assert.equal(ST.paperFor('GB'), 'a4');
  assert.equal(ST.paperFor(null), 'a4');
  assert.equal(ST.defaultDefaults('GBP', 'GB').taxLabel, 'VAT');
  assert.equal(ST.defaultDefaults('AUD', 'AU').taxLabel, 'GST');
  assert.equal(ST.defaultDefaults('nope', 'US').currency, 'USD');
  const d = ST.parseDefaults('{"taxRate": 900, "template": "fancy", "paper": "a4", "currency": "EUR", "notes": {"invoice": "Thanks"}}', DEFAULTS);
  assert.equal(d.taxRate, DEFAULTS.taxRate);
  assert.equal(d.template, 'ledger');
  assert.equal(d.paper, 'a4');
  assert.equal(d.currency, 'EUR');
  assert.equal(d.notes.invoice, 'Thanks');
  assert.equal(d.notes.estimate, DEFAULTS.notes.estimate);
  assert.deepEqual(ST.parseDefaults('{broken', DEFAULTS), DEFAULTS);
  assert.deepEqual(ST.parseBusiness('{broken'), ST.EMPTY_BUSINESS);
  assert.equal(ST.parseBusiness('{"name": 7, "phone": "555"}').phone, '555');
  assert.equal(ST.parseLogo('{"base64": "x", "width": 0, "height": 1}'), null);
  assert.equal(ST.parseOwnerSignature('{"strokes": [], "width": 1, "height": 1}'), null);
  assert.equal(ST.TEMPLATES.length, 3);
});

// ---------- the phone's formats ----------

test('money and dates in the phone\'s format; the decimal mark is read from the locale', () => {
  assert.equal(F.formatMoney(125050, 'USD', 'en-US'), '$1,250.50');
  assert.match(F.formatMoney(125050, 'EUR', 'de-DE'), /^1\.250,50\s€$/);
  assert.equal(F.formatMoney(150000, 'JPY', 'ja-JP').replace(/\s/g, ''), '￥1,500');
  assert.equal(F.formatMoney(-500, 'GBP', 'en-GB'), '-£5.00');
  assert.equal(F.currencyDigits('JPY'), 0);
  assert.equal(F.currencyDigits('USD'), 2);
  assert.equal(F.decimalMark('de-DE'), ',');
  assert.equal(F.decimalMark('en-US'), '.');
  assert.equal(F.moneyInput(125050, 'USD', 'en-US'), '1250.50');
  assert.equal(F.moneyInput(125050, 'EUR', 'fr-FR'), '1250,50');
  assert.equal(F.moneyInput(0, 'USD', 'en-US'), '');
  assert.equal(F.formatNumber(1.5, 'de-DE'), '1,5');
  assert.equal(F.formatDate('2026-11-17', 'en-US'), 'Nov 17, 2026');
  assert.equal(F.formatDate('2026-11-17', 'en-GB'), '17 Nov 2026');
  assert.match(F.formatMoney(100, 'XXZ', 'en-US'), /1\.00/, 'an unknown code still prints');
  assert.equal(F.formatMoney(100, 'not a code', 'en-US'), '$1.00', 'a broken code falls back instead of throwing');
  assert.equal(F.currencyList('USD')[0].code, 'USD');
  assert.equal(F.currencyList('ZWL')[0].code, 'ZWL');
});

test('dates: add days across month and year ends, and across a clock change', () => {
  assert.equal(DT.addDays('2026-12-25', 14), '2027-01-08');
  assert.equal(DT.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(DT.addDays('2026-03-07', 1), '2026-03-08');
  assert.equal(DT.daysBetween('2026-11-01', '2026-11-17'), 16);
  assert.equal(DT.isIsoDay('2026-02-30'), false);
  assert.equal(DT.isIsoDay('2026-02-28'), true);
});
