/**
 * Everything the screens read and write, over the SQLite database: the
 * business profile, logo and signature, the defaults, numbering, clients,
 * saved items and the document list. Screens call these actions; nothing
 * else touches the database.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getDb } from './db/native';
import * as repo from './db/repo';
import type { Client, Item } from './db/repo';
import type { Counter } from './numbering';
import type { Doc, DocType, Status } from './model';
import { newId } from './model';
import { DocRow, makeDoc, rowOf } from './docs';
import { isoDay } from './dates';
import { Business, Defaults, defaultDefaults, EMPTY_BUSINESS, Logo, OwnerSignature, parseBusiness, parseDefaults, parseLogo, parseOwnerSignature } from './settings';
import { phoneLocale, PhoneLocale } from './locale';

const K = { business: 'business.profile', logo: 'business.logo', signature: 'business.signature', defaults: 'defaults' };

interface Data {
  loaded: boolean;
  failed: string | null;
  locale: PhoneLocale;
  business: Business;
  logo: Logo | null;
  signature: OwnerSignature | null;
  defaults: Defaults;
  counters: Record<DocType, Counter>;
  clients: Client[];
  items: Item[];
  rows: DocRow[];
  saveBusiness: (b: Business) => Promise<void>;
  saveLogo: (l: Logo | null) => Promise<void>;
  saveSignature: (s: OwnerSignature | null) => Promise<void>;
  saveDefaults: (d: Defaults) => Promise<void>;
  saveCounter: (type: DocType, c: Counter) => Promise<void>;
  saveClient: (c: Client) => Promise<void>;
  removeClient: (id: string) => Promise<void>;
  saveItem: (it: Item) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  newDoc: (type: DocType, client?: Client | null) => Promise<Doc>;
  getDoc: (id: string) => Promise<Doc | null>;
  saveDoc: (d: Doc) => Promise<void>;
  setStatus: (id: string, status: Status) => Promise<void>;
  convert: (id: string, target: DocType) => Promise<Doc | null>;
  duplicate: (id: string) => Promise<Doc | null>;
  removeDoc: (id: string) => Promise<void>;
}

const Ctx = createContext<Data | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const locale = useMemo(phoneLocale, []);
  const fallback = useMemo(() => defaultDefaults(locale.currency ?? 'USD', locale.region), [locale]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [business, setBusiness] = useState<Business>(EMPTY_BUSINESS);
  const [logo, setLogo] = useState<Logo | null>(null);
  const [signature, setSignature] = useState<OwnerSignature | null>(null);
  const [defaults, setDefaults] = useState<Defaults>(fallback);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const [counters, setCounters] = useState<Record<DocType, Counter>>({} as Record<DocType, Counter>);
  const [clients, setClients] = useState<Client[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [rows, setRows] = useState<DocRow[]>([]);

  const reloadRows = useCallback(async () => setRows(await repo.listRows(await getDb())), []);
  const reloadCounters = useCallback(async () => setCounters(await repo.getCounters(await getDb())), []);

  useEffect(() => {
    (async () => {
      try {
        const db = await getDb();
        setBusiness(parseBusiness(await repo.kvGet(db, K.business)));
        setLogo(parseLogo(await repo.kvGet(db, K.logo)));
        setSignature(parseOwnerSignature(await repo.kvGet(db, K.signature)));
        setDefaults(parseDefaults(await repo.kvGet(db, K.defaults), fallback));
        setCounters(await repo.getCounters(db));
        setClients(await repo.listClients(db));
        setItems(await repo.listItems(db));
        setRows(await repo.listRows(db));
      } catch (e: any) {
        setFailed(e?.message ?? 'The database did not open.');
      }
      setLoaded(true);
    })();
  }, [fallback]);

  const value = useMemo<Data>(() => {
    const db = getDb;
    return {
      loaded,
      failed,
      locale,
      business,
      logo,
      signature,
      defaults,
      counters,
      clients,
      items,
      rows,
      saveBusiness: async (b) => {
        setBusiness(b);
        await repo.kvSet(await db(), K.business, JSON.stringify(b));
      },
      saveLogo: async (l) => {
        setLogo(l);
        if (l) await repo.kvSet(await db(), K.logo, JSON.stringify(l));
        else await repo.kvDelete(await db(), K.logo);
      },
      saveSignature: async (s) => {
        setSignature(s);
        if (s) await repo.kvSet(await db(), K.signature, JSON.stringify(s));
        else await repo.kvDelete(await db(), K.signature);
      },
      saveDefaults: async (d) => {
        setDefaults(d);
        await repo.kvSet(await db(), K.defaults, JSON.stringify(d));
      },
      saveCounter: async (type, c) => {
        await repo.setCounter(await db(), type, c);
        await reloadCounters();
      },
      saveClient: async (c) => {
        const d = await db();
        await repo.saveClient(d, c);
        setClients(await repo.listClients(d));
        await reloadRows();
      },
      removeClient: async (id) => {
        const d = await db();
        await repo.deleteClient(d, id);
        setClients(await repo.listClients(d));
        await reloadRows();
      },
      saveItem: async (it) => {
        const d = await db();
        await repo.saveItem(d, it);
        setItems(await repo.listItems(d));
      },
      removeItem: async (id) => {
        const d = await db();
        await repo.deleteItem(d, id);
        setItems(await repo.listItems(d));
      },
      newDoc: async (type, client) => {
        const now = Date.now();
        const doc = await repo.createDoc(await db(), type, (number) =>
          makeDoc({
            id: newId(now),
            lineId: newId(now + 1),
            type,
            number,
            today: isoDay(now),
            now,
            defaults: defaultsRef.current,
            client: client ? { id: client.id, snap: { name: client.name, email: client.email, phone: client.phone, address: client.address } } : undefined,
          })
        );
        await Promise.all([reloadRows(), reloadCounters()]);
        return doc;
      },
      getDoc: async (id) => repo.getDoc(await db(), id),
      saveDoc: async (d) => {
        const next = { ...d, updatedAt: Date.now() };
        await repo.saveDoc(await db(), next);
        // The list updates in place; a full reload only when the number may have moved a counter.
        setRows((rs) => {
          const r = rowOf(next);
          const i = rs.findIndex((x) => x.id === r.id);
          if (i < 0) return [r, ...rs];
          const copy = rs.slice();
          copy[i] = r;
          return copy;
        });
        reloadCounters();
      },
      setStatus: async (id, status) => {
        await repo.setStatus(await db(), id, status, Date.now());
        await reloadRows();
      },
      convert: async (id, target) => {
        const now = Date.now();
        const doc = await repo.convertAndSave(await db(), id, target, { today: isoDay(now), now, defaults: defaultsRef.current });
        await Promise.all([reloadRows(), reloadCounters()]);
        return doc;
      },
      duplicate: async (id) => {
        const now = Date.now();
        const doc = await repo.duplicateAndSave(await db(), id, { today: isoDay(now), now, defaults: defaultsRef.current });
        await Promise.all([reloadRows(), reloadCounters()]);
        return doc;
      },
      removeDoc: async (id) => {
        await repo.deleteDoc(await db(), id);
        await reloadRows();
      },
    };
  }, [loaded, failed, locale, business, logo, signature, defaults, counters, clients, items, rows, reloadRows, reloadCounters]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): Data {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}

/** Formatting helpers bound to the phone's locale. */
export { formatMoney, formatDate } from './format';
