/**
 * Files on the phone. The documents, clients, items and settings live in
 * SQLite (src/db); this module holds the small key/value settings file and
 * the share copies of exported PDFs in the cache folder.
 */
import { Directory, File, Paths } from 'expo-file-system';

function dir(...parts: string[]): Directory {
  const d = new Directory(Paths.document, ...parts);
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

function cacheDir(name: string): Directory {
  const d = new Directory(Paths.cache, name);
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

function readText(f: File): string | null {
  try {
    return f.exists ? f.textSync() : null;
  } catch {
    return null;
  }
}

/** Writes through a temporary file and a move, so a crash never leaves half a JSON file. */
function writeText(f: File, text: string): void {
  const tmp = new File(f.parentDirectory, `${f.name}.tmp`);
  if (tmp.exists) tmp.delete();
  tmp.create();
  tmp.write(text);
  if (f.exists) f.delete();
  tmp.moveSync(f);
}

// ---------- key/value ----------

let kvCache: Record<string, string> | null = null;
const kvFile = () => new File(dir(), 'settings.json');

function kvLoad(): Record<string, string> {
  if (kvCache) return kvCache;
  try {
    const raw = JSON.parse(readText(kvFile()) ?? '{}');
    kvCache = raw && typeof raw === 'object' ? raw : {};
  } catch {
    kvCache = {};
  }
  return kvCache!;
}

export async function kvGet(key: string): Promise<string | null> {
  return kvLoad()[key] ?? null;
}

export async function kvSet(key: string, value: string): Promise<void> {
  const all = { ...kvLoad(), [key]: value };
  kvCache = all;
  writeText(kvFile(), JSON.stringify(all));
}

export async function kvAll(prefix: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(kvLoad())) if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
  return out;
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
