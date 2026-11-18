/**
 * The database layout and its migrations. Pure (no native imports), so
 * `npm test` runs the same migrations on Node's SQLite.
 *
 * Rules: MIGRATIONS only ever grows. A shipped migration is never edited
 * or reordered; a change is a new entry at the end. PRAGMA user_version
 * holds how many have run.
 */

export type Param = string | number | null;

/** The little the app needs from a database: expo-sqlite in the app, node:sqlite in the tests. */
export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: Param[]): Promise<void>;
  all<T>(sql: string, params?: Param[]): Promise<T[]>;
  get<T>(sql: string, params?: Param[]): Promise<T | null>;
  /** Runs fn inside one transaction: all of it lands, or none of it. */
  tx(fn: () => Promise<void>): Promise<void>;
}

export const MIGRATIONS: string[] = [
  // 1: 1.0.0
  `
  CREATE TABLE kv (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  CREATE TABLE counters (
    type TEXT PRIMARY KEY NOT NULL,
    prefix TEXT NOT NULL,
    next INTEGER NOT NULL
  );
  CREATE TABLE clients (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE items (
    id TEXT PRIMARY KEY NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    rate INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT '',
    taxable INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE docs (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    number TEXT NOT NULL,
    status TEXT NOT NULL,
    client_id TEXT,
    client_name TEXT NOT NULL DEFAULT '',
    client_email TEXT NOT NULL DEFAULT '',
    client_phone TEXT NOT NULL DEFAULT '',
    client_address TEXT NOT NULL DEFAULT '',
    issue_date TEXT NOT NULL,
    due_date TEXT,
    currency TEXT NOT NULL,
    discount_kind TEXT NOT NULL DEFAULT 'percent',
    discount_value REAL NOT NULL DEFAULT 0,
    tax_rate REAL NOT NULL DEFAULT 0,
    tax_label TEXT NOT NULL DEFAULT 'Tax',
    paid INTEGER NOT NULL DEFAULT 0,
    payment_note TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    terms TEXT NOT NULL DEFAULT '',
    owner_sign INTEGER NOT NULL DEFAULT 1,
    client_signed TEXT,
    source_id TEXT,
    total INTEGER NOT NULL DEFAULT 0,
    balance INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX docs_issue ON docs (issue_date);
  CREATE INDEX docs_client ON docs (client_id);
  CREATE TABLE lines (
    id TEXT PRIMARY KEY NOT NULL,
    doc_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    qty REAL NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT '',
    rate INTEGER NOT NULL DEFAULT 0,
    taxable INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX lines_doc ON lines (doc_id, position);
  `,
];

/** Runs every migration this database has not had yet, each in its own transaction. Returns the version it ends at. */
export async function migrate(db: Db): Promise<number> {
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  let v = Number(row?.user_version ?? 0);
  if (v > MIGRATIONS.length) throw new Error(`This database is from a newer version of the app (${v}).`);
  while (v < MIGRATIONS.length) {
    const sql = MIGRATIONS[v];
    const next = v + 1;
    await db.tx(async () => {
      await db.exec(sql);
      await db.exec(`PRAGMA user_version = ${next}`);
    });
    v = next;
  }
  return v;
}
