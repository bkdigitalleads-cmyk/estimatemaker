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
import PaywallModal from './src/screens/Paywall';
import Welcome, { TrialSteps } from './src/screens/Welcome';
import TabBar, { Tab } from './src/ui/TabBar';
import { Drawer, InkButton, Title, Toast } from './src/ui/Kit';

function Shell() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { ready, notice, isPro, askPro } = useApp();
  const [tab, setTab] = useState<Tab>('documents');
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  // New installs: four screens, the first estimate, the trial and reminder screens, then the paywall.
  const [step, setStep] = useState<'intro' | 'trial' | 'paywall'>('intro');
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
      if (isPro) {
        kvSet(ONBOARDED_KEY, '1').catch(() => {});
        return setOnboarded(true);
      }
      setOnboarded(false);
    })().catch(() => setOnboarded(true)); // fail open: never trap anyone
  }, [ready, onboarded, isPro]);

  const openOnboardingPaywall = () => {
    if (paywallOpened.current) return;
    paywallOpened.current = true;
    setStep('paywall');
    askPro('pro').then((pro) => {
      if (afterOnboardingPaywall(pro) === 'claim') setTimeout(() => setClaim(true), 450);
      kvSet(ONBOARDED_KEY, '1').catch(() => {});
      setOnboarded(true);
    });
  };

  if (!ready || onboarded === null) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  if (!onboarded) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />
        {step === 'intro' && <Welcome onDone={() => setStep('trial')} />}
        {(step === 'trial' || step === 'paywall') && <TrialSteps onDone={openOnboardingPaywall} />}
        <PaywallModal privacyUrl={PRIVACY_URL} onboarding />
      </View>
    );
  }

  let body: React.ReactNode;
  if (tab === 'settings')
    body = (
      <Settings
        onReplayOnboarding={() => {
          paywallOpened.current = false;
          setStep('intro');
          setOnboarded(false);
        }}
      />
    );
  else
    body = (
      <View style={{ padding: space.l }}>
        <Title theme={theme}>Documents</Title>
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>{body}</View>
      <TabBar theme={theme} tab={tab} onTab={setTab} />
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
          <Shell />
        </AppProvider>
      </SafeAreaProvider>
    </Guard>
  );
}
