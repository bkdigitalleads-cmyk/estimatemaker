import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import { initPurchases, getIsPro, checkPro, onProChange } from './purchases';
import { syncTrialReminder } from './reminder';
import { hasSandboxPro } from './testing';
import { setReviewGuard } from './reviews';
import { kvGet, kvSet } from './store';
import { FreeExports, parseFreeExports, PaywallReason, recordFreeExport } from './gates';

export const ONBOARDED_KEY = 'flag.onboarded';
const FREE_EXPORTS_KEY = 'usage.freeExports';
/** Test builds only: Pro is ignored on this phone while this is on. */
const ACT_FREE_KEY = 'test.actFree';

interface AppState {
  ready: boolean;
  isPro: boolean;
  setIsPro: (v: boolean) => void;
  testBuild: boolean;
  actFree: boolean;
  setActFree: (v: boolean) => Promise<void>;
  /** Why the in-app paywall is open, or null. */
  paywall: PaywallReason | null;
  /** Opens the paywall; resolves with whether Pro is on once it closes. */
  askPro: (reason: PaywallReason) => Promise<boolean>;
  hidePaywall: () => void;
  /** The documents that went out free (the first two). */
  freeExports: FreeExports;
  noteFreeExport: (docId: string) => void;
  resetFreeExports: () => void;
  /** The Sign here pad is open (no rating prompt then). */
  setSigning: (v: boolean) => void;
  notice: string | null;
  say: (text: string) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [storePro, setStorePro] = useState(false);
  const [sandbox, setSandbox] = useState(false);
  const [actFree, setActFreeState] = useState(false);
  const [paywall, setPaywall] = useState<PaywallReason | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const [freeExports, setFreeExports] = useState<FreeExports>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signingRef = useRef(false);

  const say = useCallback((text: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = setTimeout(() => setNotice(null), 3200);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setFreeExports(parseFreeExports(await kvGet(FREE_EXPORTS_KEY)));
        setActFreeState((await kvGet(ACT_FREE_KEY)) === '1');
      } catch {
        // unreadable storage -> defaults
      }
      try {
        await initPurchases();
        setStorePro(await getIsPro());
        setSandbox(await hasSandboxPro());
      } catch {
        setStorePro(false);
      }
      setReady(true);
    })();
  }, []);

  // Keep Pro in step with the store without a relaunch (renewals, expiries,
  // refunds), and re-check after a real trip to the background. The same
  // foreground check drops the trial reminder once the trial is over.
  useEffect(() => {
    if (!ready) return;
    syncTrialReminder();
    const unsubscribe = onProChange((v) => {
      setStorePro(v);
      hasSandboxPro().then(setSandbox);
    });
    let wasBackground = false;
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'background') wasBackground = true;
      if (s !== 'active' || !wasBackground) return;
      wasBackground = false;
      checkPro().then((v) => {
        if (v !== null) setStorePro(v);
      });
      syncTrialReminder();
    });
    return () => {
      unsubscribe();
      sub.remove();
    };
  }, [ready]);

  useEffect(() => setReviewGuard(() => signingRef.current), []);

  const testBuild = __DEV__ || sandbox;
  const isPro = storePro && !(testBuild && actFree);
  const proRef = useRef(isPro);
  proRef.current = isPro;

  const askPro = useCallback((reason: PaywallReason) => {
    if (proRef.current) return Promise.resolve(true);
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setPaywall(reason);
    });
  }, []);

  const hidePaywall = useCallback(() => {
    setPaywall(null);
    const r = resolver.current;
    resolver.current = null;
    // After the purchase sets Pro, on the next tick.
    setTimeout(() => r?.(proRef.current), 0);
  }, []);

  const setIsPro = useCallback(
    (v: boolean) => {
      proRef.current = v && !(testBuild && actFree);
      setStorePro(v);
    },
    [testBuild, actFree]
  );

  const noteFreeExport = useCallback((docId: string) => {
    setFreeExports((list) => {
      const next = recordFreeExport(list, docId);
      if (next !== list) kvSet(FREE_EXPORTS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const resetFreeExports = useCallback(() => {
    setFreeExports([]);
    kvSet(FREE_EXPORTS_KEY, '[]').catch(() => {});
  }, []);

  const setActFree = useCallback(
    async (v: boolean) => {
      if (!testBuild) return;
      setActFreeState(v);
      await kvSet(ACT_FREE_KEY, v ? '1' : '0').catch(() => {});
    },
    [testBuild]
  );

  const setSigning = useCallback((v: boolean) => {
    signingRef.current = v;
  }, []);

  const value = useMemo<AppState>(
    () => ({
      ready,
      isPro,
      setIsPro,
      testBuild,
      actFree: testBuild && actFree,
      setActFree,
      paywall,
      askPro,
      hidePaywall,
      freeExports,
      noteFreeExport,
      resetFreeExports,
      setSigning,
      notice,
      say,
    }),
    [ready, isPro, setIsPro, testBuild, actFree, setActFree, paywall, askPro, hidePaywall, freeExports, noteFreeExport, resetFreeExports, setSigning, notice, say]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
