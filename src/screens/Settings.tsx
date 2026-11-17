import React, { useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { useTheme, radius, space, tabular, type, Theme } from '../theme';
import { useData } from '../data';
import { currencyList } from '../format';
import { DOC_TYPES, DocType, TYPE_LABEL } from '../model';
import { cleanNext, cleanPrefix, formatNumber as formatDocNumber } from '../numbering';
import type { Counter } from '../numbering';
import { TEMPLATES } from '../settings';
import { useApp } from '../state';
import { restorePurchases } from '../purchases';
import { cancelTrialReminder } from '../reminder';
import { kvSet } from '../store';
import { PRIVACY_URL, SUPPORT_EMAIL, SUPPORT_MAIL_URL, SUPPORT_URL, TERMS_URL } from '../links';
import Glyph from '../ui/Glyph';
import { Caption, Drawer, InkButton, Label, Panel, Row, Title } from '../ui/Kit';
import { Choice, InputRow, NumberRow, Section } from '../ui/Form';

/** Pro, restore, help and the About card. Test tools behind seven taps on the version, in test builds only. */
export default function Settings({ onReplayOnboarding, onBusiness, onSignature }: { onReplayOnboarding: () => void; onBusiness: () => void; onSignature: () => void }) {
  const theme = useTheme();
  const data = useData();
  const { defaults, locale } = data;
  const [sheet, setSheet] = useState<null | 'currency' | 'numbers' | 'tax'>(null);
  const setDefaults = (patch: Partial<typeof defaults>) => data.saveDefaults({ ...defaults, ...patch });
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

      <Section theme={theme} label="Your business">
        <Row theme={theme} first glyph="documents" label={data.business.name || 'Name, logo and address'} sub={data.business.name ? 'Logo, address, phone, email, tax number' : 'Printed on every document'} onPress={onBusiness} />
        <Row theme={theme} glyph="sign" label="Your signature" sub={data.signature ? 'Saved' : 'Not added yet'} onPress={onSignature} />
      </Section>

      <Section theme={theme} label="New documents">
        <Row theme={theme} first label="Currency" sub={currencyList(locale.currency).find((c) => c.code === defaults.currency)?.name ?? defaults.currency} onPress={() => setSheet('currency')} right={<Text style={[type.body, tabular, { color: theme.ink }]}>{defaults.currency}</Text>} />
        <Row theme={theme} label="Tax" sub={defaults.taxRate > 0 ? `${defaults.taxLabel} ${defaults.taxRate}% on new documents` : `No ${defaults.taxLabel.toLowerCase()} by default`} onPress={() => setSheet('tax')} />
        <Row theme={theme} label="Numbers" sub={DOC_TYPES.map((t) => formatDocNumber(data.counters[t]?.prefix ?? '', data.counters[t]?.next ?? 1)).join(', ')} onPress={() => setSheet('numbers')} />
      </Section>

      <View>
        <Label theme={theme}>PDF</Label>
        <View style={{ gap: space.m }}>
          <Choice theme={theme} label="Template" options={TEMPLATES.map((t) => ({ id: t.id, label: t.label }))} value={defaults.template} onChange={(template) => setDefaults({ template })} />
          <Choice
            theme={theme}
            label="Paper size"
            options={[
              { id: 'letter', label: 'US Letter' },
              { id: 'a4', label: 'A4' },
            ]}
            value={defaults.paper}
            onChange={(paper) => setDefaults({ paper })}
          />
          <Caption theme={theme}>The color and template can also be picked on the preview of any document.</Caption>
        </View>
      </View>

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
      <Drawer theme={theme} visible={sheet === 'currency'} onClose={() => setSheet(null)} title="Currency">
        <Panel theme={theme} style={{ marginBottom: space.l }}>
          {currencyList(locale.currency).map((c, i) => (
            <Row
              key={c.code}
              theme={theme}
              first={i === 0}
              label={`${c.code}  ${c.name}`}
              onPress={() => {
                setDefaults({ currency: c.code });
                setSheet(null);
              }}
              right={c.code === defaults.currency ? <Glyph name="check" size={20} color={theme.ink} /> : <View />}
            />
          ))}
        </Panel>
        <Caption theme={theme} style={{ marginBottom: space.l }}>New documents use this currency. Documents you already made keep theirs.</Caption>
      </Drawer>
      <Drawer theme={theme} visible={sheet === 'tax'} onClose={() => setSheet(null)} title="Tax">
        <TaxEditor theme={theme} label={defaults.taxLabel} rate={defaults.taxRate} locale={locale.tag} dueDays={defaults.dueDays} validDays={defaults.validDays} onDone={(p) => {
          setDefaults(p);
          setSheet(null);
        }} />
      </Drawer>
      <Drawer theme={theme} visible={sheet === 'numbers'} onClose={() => setSheet(null)} title="Numbers">
        <NumbersEditor theme={theme} counters={data.counters} onDone={async (next) => {
          for (const t of DOC_TYPES) await data.saveCounter(t, next[t]);
          setSheet(null);
        }} />
      </Drawer>
    </ScrollView>
  );
}

function TaxEditor({ theme, label, rate, locale, dueDays, validDays, onDone }: { theme: Theme; label: string; rate: number; locale: string; dueDays: number; validDays: number; onDone: (p: { taxLabel: string; taxRate: number; dueDays: number; validDays: number }) => void }) {
  const [l, setL] = useState(label);
  const [r, setR] = useState(rate);
  const [d, setD] = useState(dueDays);
  const [v, setV] = useState(validDays);
  return (
    <View style={{ gap: space.l, paddingBottom: space.l }}>
      <Section theme={theme}>
        <InputRow theme={theme} first label="Name" value={l} onChangeText={setL} placeholder="Tax, VAT, GST" maxLength={12} />
        <NumberRow theme={theme} label="Rate" value={r} onValue={setR} locale={locale} suffix="%" allowEmpty />
        <NumberRow theme={theme} label="Invoices due in" value={d} onValue={(n) => setD(Math.max(0, Math.round(n)))} locale={locale} suffix="days" />
        <NumberRow theme={theme} label="Estimates valid" value={v} onValue={(n) => setV(Math.max(0, Math.round(n)))} locale={locale} suffix="days" />
      </Section>
      <Caption theme={theme}>Each line can still be marked taxable or not, and any document can use another rate.</Caption>
      <InkButton theme={theme} label="Save" onPress={() => onDone({ taxLabel: l.trim() || 'Tax', taxRate: Math.min(100, Math.max(0, r)), dueDays: Math.min(365, d), validDays: Math.min(365, v) })} />
    </View>
  );
}

function NumbersEditor({ theme, counters, onDone }: { theme: Theme; counters: Record<DocType, Counter>; onDone: (c: Record<DocType, Counter>) => void }) {
  const [c, setC] = useState(counters);
  return (
    <View style={{ gap: space.l, paddingBottom: space.l }}>
      <Panel theme={theme}>
        {DOC_TYPES.map((t, i) => (
          <View key={t} style={[styles.numRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.rule }]}>
            <Text style={[type.body, { color: theme.inkSoft, width: 72 }]}>{TYPE_LABEL[t]}</Text>
            <TextInput
              value={c[t].prefix}
              onChangeText={(prefix) => setC({ ...c, [t]: { ...c[t], prefix: cleanPrefix(prefix) } })}
              autoCapitalize="characters"
              accessibilityLabel={`${TYPE_LABEL[t]} prefix`}
              style={[type.body, styles.numInput, { color: theme.ink, borderColor: theme.edge, width: 76 }]}
            />
            <TextInput
              value={String(c[t].next)}
              onChangeText={(n) => setC({ ...c, [t]: { ...c[t], next: cleanNext(n.replace(/\D/g, ''), 1) } })}
              keyboardType="number-pad"
              accessibilityLabel={`${TYPE_LABEL[t]} next number`}
              style={[type.body, tabular, styles.numInput, { color: theme.ink, borderColor: theme.edge, width: 72 }]}
            />
            <Text style={[type.small, tabular, { color: theme.inkSoft, flex: 1, textAlign: 'right' }]} numberOfLines={1}>
              {formatDocNumber(c[t].prefix, c[t].next)}
            </Text>
          </View>
        ))}
      </Panel>
      <Caption theme={theme}>Each type counts on its own. The next new one gets the number shown.</Caption>
      <InkButton theme={theme} label="Save" onPress={() => onDone(c)} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.l, gap: space.xl, paddingBottom: space.xxl },
  numRow: { flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: 52, paddingHorizontal: space.l },
  numInput: { minHeight: 40, borderRadius: radius.small, borderWidth: 1, paddingHorizontal: space.s },
  about: { padding: space.l, gap: space.s },
});
