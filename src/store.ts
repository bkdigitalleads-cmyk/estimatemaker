/**
 * Storage on the phone. The documents, clients, items and settings live in
 * SQLite (src/db, one file, estimatemaker.db); this module has the small
 * key/value helpers over it and the share copies of exported PDFs in the
 * cache folder, which are cleared at the next launch.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { getDb } from './db/native';
import * as repo from './db/repo';

function cacheDir(name: string): Directory {
  const d = new Directory(Paths.cache, name);
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

// ---------- key/value (the kv table in SQLite) ----------

export async function kvGet(key: string): Promise<string | null> {
  return repo.kvGet(await getDb(), key);
}

export async function kvSet(key: string, value: string): Promise<void> {
  await repo.kvSet(await getDb(), key, value);
}

// ---------- share copies ----------

/** A file for the share sheet, Mail or Print in the cache, under a readable name. */
export function shareFile(name: string, data: Uint8Array | string): string {
  const d = new Directory(cacheDir('share'), Date.now().toString(36));
  d.create({ intermediates: true, idempotent: true });
  const f = new File(d, name);
  f.create();
  if (typeof data === 'string') f.write(data, { encoding: 'base64' });
  else f.write(data);
  return f.uri;
}

export function readBytes(uri: string): Uint8Array {
  return new File(uri).bytesSync();
}

/** Clears yesterday's share copies at launch. */
export function sweepCache(): void {
  try {
    const d = new Directory(Paths.cache, 'share');
    if (d.exists) d.delete();
  } catch {
    // harmless
  }
}
