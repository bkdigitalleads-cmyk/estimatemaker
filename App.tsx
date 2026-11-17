import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useTheme, UI_FONT_FILES, space, type } from './src/theme';
import { AppProvider, useApp, ONBOARDED_KEY } from './src/state';
import { kvGet, kvSet, sweepCache } from './src/store';
import { afterOnboardingPaywall } from './src/rules';
import { PRIVACY_URL } from './src/links';
import Settings from './src/screens/Settings';
import Documents from './src/screens/Documents';
import Editor from './src/screens/Editor';
import Clients, { ClientEditor } from './src/screens/Clients';
import Items, { ItemEditor } from './src/screens/Items';
import Business from './src/screens/Business';
import { MySignature, SignHere } from './src/screens/Sign';
import Preview from './src/screens/Preview';
import { DataProvider, useData } from './src/data';
import type { Client, Item } from './src/db/repo';
import type { DocType } from './src/model';
import PaywallModal from './src/screens/Paywall';
import Welcome, { FirstEstimate, TrialSteps } from './src/screens/Welcome';
import { PageWindow } from './src/ui/Showcase';
import type { Doc } from './src/model';
import TabBar, { Tab } from './src/ui/TabBar';
import { Drawer, InkButton, Title, Toast } from './src/ui/Kit';

/** A screen over the tabs. Back pops one. */
type Over =
  | { name: 'doc'; id: string }
  | { name: 'preview'; id: string }
  | { name: 'signHere'; id: string }
  | { name: 'mySignature' }
  | { name: 'business' }
  | { name: 'client'; client: Client | null }
  | { name: 'item'; item: Item | null };

function Shell() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { ready, notice, isPro, askPro } = useApp();
  const data = useData();
  const [tab, setTab] = useState<Tab>('documents');
  const [stack, setStack] = useState<Over[]>([]);
  const push = (o: Over) => setStack((s) => [...s, o]);
  const pop = () => setStack((s) => s.slice(0, -1));
  /** Opens a document in place of the one on top (after convert or duplicate, back goes to the list). */
  const openDoc = (id: string) => setStack((s) => [...s.filter((o) => o.name !== 'doc' && o.name !== 'preview'), { name: 'doc', id }]);
  const newDoc = async (type: DocType, client?: Client | null) => {
    const d = await data.newDoc(type, client ?? null);
    setTab('documents');
    setStack([{ name: 'doc', id: d.id }]);
  };
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  // New installs: four screens, the first estimate, the trial and reminder screens, then the paywall.
  const [step, setStep] = useState<'intro' | 'first' | 'trial' | 'paywall'>('intro');
  const [firstDoc, setFirstDoc] = useState<Doc | null>(null);
  // After the onboarding paywall is closed with the X: the small "first two PDFs are free" sheet.
  const [claim, setClaim] = useState(false);
  const paywallOpened = useRef(false);

  useEffect(() => {
    sweepCache();
  }, []);

  useEffect(() => {
    if (!ready || onboarded !== null) return;
    (async () => {
      if ((await kvGet(ONBOARDED_KEY)) === '1') return setOnboarded(true);
      // Anyone who already made a document, or is Pro, has used the app: no onboarding.
      if (isPro || data.rows.length > 0) {
        kvSet(ONBOARDED_KEY, '1').catch(() => {});
        return setOnboarded(true);
      }
      setOnboarded(false);
    })().catch(() => setOnboarded(true)); // fail open: never trap anyone
  }, [ready, onboarded, isPro, data.rows.length]);

  const openOnboardingPaywall = () => {
    if (paywallOpened.current) return;
    paywallOpened.current = true;
    setStep('paywall');
    askPro('pro').then((pro) => {
      if (afterOnboardingPaywall(pro) === 'claim') setTimeout(() => setClaim(true), 450);
      kvSet(ONBOARDED_KEY, '1').catch(() => {});
      setOnboarded(true);
      // The first estimate is open and ready to finish.
      if (firstDoc) setStack([{ name: 'doc', id: firstDoc.id }]);
    });
  };

  if (!ready || !data.loaded || onboarded === null) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  if (data.failed) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: space.l, paddingTop: insets.top + space.xxl }}>
        <Title theme={theme}>Your documents did not open.</Title>
        <Text style={[type.body, { color: theme.inkSoft, marginTop: space.s }]}>Close the app and open it again. If it keeps happening, write to support from the App Store page. ({data.failed})</Text>
      </View>
    );
  }

  if (!onboarded) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />
        {step === 'intro' && <Welcome onDone={() => setStep('first')} />}
        {step === 'first' && (
          <FirstEstimate
            onDone={async (id) => {
              setFirstDoc(id ? await data.getDoc(id) : null);
              setStep('trial');
            }}
          />
        )}
        {(step === 'trial' || step === 'paywall') && <TrialSteps onDone={openOnboardingPaywall} />}
        <PaywallModal
          privacyUrl={PRIVACY_URL}
          onboarding
          hero={
            firstDoc ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                <PageWindow theme={theme} doc={firstDoc} business={data.business} width={72} height={92} accent={data.defaults.accent} locale={data.locale.tag} label="Your first estimate" />
                <Text style={[type.strong, { color: theme.ink, flex: 1 }]}>Your first estimate is saved.</Text>
              </View>
            ) : null
          }
        />
      </View>
    );
  }

  const top = stack[stack.length - 1];
  let body: React.ReactNode;
  if (top?.name === 'doc')
    body = <Editor key={top.id} id={top.id} onBack={pop} onPreview={(id) => push({ name: 'preview', id })} onSignHere={(id) => push({ name: 'signHere', id })} onOwnerSignature={() => push({ name: 'mySignature' })} onOpen={openDoc} />;
  else if (top?.name === 'preview') body = <Preview key={top.id} id={top.id} onBack={pop} onBusiness={() => push({ name: 'business' })} />;
  else if (top?.name === 'signHere') body = <SignHere docId={top.id} onBack={pop} />;
  else if (top?.name === 'mySignature') body = <MySignature onBack={pop} />;
  else if (top?.name === 'business') body = <Business onBack={pop} />;
  else if (top?.name === 'client') body = <ClientEditor client={top.client} onBack={pop} onOpenDoc={(id) => push({ name: 'doc', id })} onNewDoc={(c) => newDoc('estimate', c)} />;
  else if (top?.name === 'item') body = <ItemEditor item={top.item} onBack={pop} />;
  else if (tab === 'documents') body = <Documents onOpen={(id) => push({ name: 'doc', id })} onNew={(t) => newDoc(t)} />;
  else if (tab === 'clients') body = <Clients onEdit={(client) => push({ name: 'client', client })} />;
  else if (tab === 'items') body = <Items onEdit={(item) => push({ name: 'item', item })} />;
  else
    body = (
      <Settings
        onBusiness={() => push({ name: 'business' })}
        onSignature={() => push({ name: 'mySignature' })}
        onReplayOnboarding={() => {
          paywallOpened.current = false;
          setStep('intro');
          setOnboarded(false);
        }}
      />
    );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>{body}</View>
      {top == null ? <TabBar theme={theme} tab={tab} onTab={setTab} /> : null}
      <Toast theme={theme} text={notice} top={insets.top} />
      <PaywallModal privacyUrl={PRIVACY_URL} />
      <Drawer theme={theme} visible={claim} onClose={() => setClaim(false)}>
        <Text style={[type.title, { color: theme.ink }]} accessibilityRole="header">
          Your first two PDFs are free.
        </Text>
        <Text style={[type.body, { color: theme.inkSoft, marginTop: space.s, marginBottom: space.xl }]}>Drafts, clients and items stay free as long as you use the app.</Text>
        <InkButton theme={theme} label="Got it" onPress={() => setClaim(false)} />
      </Drawer>
    </View>
  );
}

/** A failure while a screen renders: shown instead of a frozen screen. Nothing is lost on disk. */
class Guard extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: '#F4F1EA', padding: space.l, paddingTop: 80 }}>
        <Text style={[type.title, { color: '#1A1917' }]}>Something went wrong on this screen.</Text>
        <Text style={[type.body, { color: '#1A1917', marginTop: space.s }]}>Close the app and open it again. Your documents are saved.</Text>
        <Text style={{ fontSize: 12, color: '#8A867F', marginTop: space.l }}>{error.message}</Text>
      </View>
    );
  }
}

export default function App() {
  const theme = useTheme();
  const [fontsLoaded, fontError] = useFonts({ ...UI_FONT_FILES });
  // If the fonts are still not in after a few seconds, open anyway with the system font.
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGaveUp(true), 6000);
    return () => clearTimeout(t);
  }, []);
  // The background colour while fonts load, so launch never flashes white.
  if (!fontsLoaded && !fontError && !gaveUp) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  return (
    <Guard>
      <SafeAreaProvider>
        <AppProvider>
          <DataProvider>
            <Shell />
          </DataProvider>
        </AppProvider>
      </SafeAreaProvider>
    </Guard>
  );
}
