import React, { useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useTheme, space, type } from '../theme';
import { useApp } from '../state';
import { restorePurchases } from '../purchases';
import { cancelTrialReminder } from '../reminder';
import { kvSet } from '../store';
import { PRIVACY_URL, SUPPORT_EMAIL, SUPPORT_MAIL_URL, SUPPORT_URL, TERMS_URL } from '../links';
import { Label, Panel, Row, Title } from '../ui/Kit';

/** Pro, restore, help and the About card. Test tools behind seven taps on the version, in test builds only. */
export default function Settings({ onReplayOnboarding }: { onReplayOnboarding: () => void }) {
  const theme = useTheme();
  const { isPro, setIsPro, askPro, testBuild, actFree, setActFree, resetFreeExports, say } = useApp();
  const [restoring, setRestoring] = useState(false);
  const [taps, setTaps] = useState(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const version = `${Constants.expoConfig?.version ?? '1.0.0'} (${Constants.expoConfig?.ios?.buildNumber ?? '1'})`;

  const restore = async () => {
    if (restoring) return;
    setRestoring(true);
    const res = await restorePurchases();
    setRestoring(false);
    if (res.ok) cancelTrialReminder();
    if (res.ok && res.isPro) {
      setIsPro(true);
      Alert.alert('Pro is back on', 'Share, mail and print as many PDFs as you need.');
    } else if (res.ok) Alert.alert('Nothing to restore', 'This Apple ID has no Estimate Maker Pro purchase.');
    else Alert.alert('Restore did not work', res.error ?? 'Try once more.');
  };

  const versionTap = () => {
    if (!testBuild) return;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setTaps(0), 2000);
    setTaps((t) => t + 1);
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Title theme={theme}>Settings</Title>

      <View>
        <Label theme={theme}>Pro</Label>
        <Panel theme={theme}>
          {isPro ? (
            <Row theme={theme} first glyph="check" label="Estimate Maker Pro is on" sub="Every PDF, shared, mailed or printed" />
          ) : (
            <Row theme={theme} first glyph="star" label="Estimate Maker Pro" sub="Every PDF, shared, mailed or printed" onPress={() => askPro('pro')} />
          )}
          <Row theme={theme} glyph="undo" label={restoring ? 'Restoring' : 'Restore purchases'} onPress={restore} right={<View />} />
        </Panel>
      </View>

      <View>
        <Label theme={theme}>Help</Label>
        <Panel theme={theme}>
          <Row theme={theme} first label="Support" sub="How to make, send and convert documents" onPress={() => Linking.openURL(SUPPORT_URL)} />
          <Row
            theme={theme}
            label="Email support"
            sub={SUPPORT_EMAIL}
            hint="Opens Mail with the subject Estimate Maker support"
            onPress={() => Linking.openURL(SUPPORT_MAIL_URL).catch(() => Alert.alert('Mail did not open', `Write to ${SUPPORT_EMAIL}.`))}
          />
          <Row theme={theme} label="Privacy Policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
          <Row theme={theme} label="Terms of Use (EULA)" onPress={() => Linking.openURL(TERMS_URL)} />
        </Panel>
      </View>

      <View>
        <Label theme={theme}>About</Label>
        <Panel theme={theme} style={styles.about}>
          <Text style={[type.body, { color: theme.ink }]}>Estimates, quotes, invoices and receipts with your own business details, made on this iPhone.</Text>
          <Text style={[type.small, { color: theme.inkSoft }]}>No account. Your documents, clients and items stay on this iPhone.</Text>
          <Text style={[type.small, { color: theme.inkFaint }]} onPress={versionTap} accessibilityRole="text">
            Version {version}
          </Text>
        </Panel>
      </View>

      {testBuild && taps >= 7 ? (
        <View>
          <Label theme={theme}>Testing (test builds only)</Label>
          <Panel theme={theme}>
            <Row theme={theme} first label="Act as a free user" right={<Switch value={actFree} onValueChange={(v) => setActFree(v)} />} />
            <Row theme={theme} label="Make the first two PDFs free again" onPress={() => { resetFreeExports(); say('Counters reset.'); }} right={<View />} />
            <Row
              theme={theme}
              label="Show onboarding again"
              onPress={() => {
                kvSet('flag.onboarded', '0').catch(() => {});
                onReplayOnboarding();
              }}
              right={<View />}
            />
          </Panel>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.l, gap: space.xl, paddingBottom: space.xxl },
  about: { padding: space.l, gap: space.s },
});
