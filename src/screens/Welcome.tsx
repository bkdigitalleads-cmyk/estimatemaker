import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, radius, space, type, Theme } from '../theme';
import { getOffering } from '../purchases';
import { getTrialEligibleIds, trialLabel } from '../trial';
import { requestReminderPermission } from '../reminder';
import { trialLength } from '../offer';
import Glyph from '../ui/Glyph';
import { InkButton, Panel, Row, Tap } from '../ui/Kit';
import { ConvertShow, EstimateShow, PageWindow, ReceiptShow, SignShow } from '../ui/Showcase';
import { previewSignature } from '../lineHelp';
import { useData } from '../data';
import { decimalMark } from '../format';
import { parseAmount } from '../money';
import { InputRow, Section } from '../ui/Form';
import type { Doc } from '../model';

/**
 * First launch, in this order (App.tsx runs it):
 *   1-4. four screens that show the product
 *   5.   the first estimate: business name and one line item, then its PDF preview
 *   a.   TrialSteps "Try it free"                      } only when RevenueCat says this
 *   b.   TrialSteps "We'll remind you the day before"  } Apple ID can get the free trial
 *   then the onboarding paywall (close button after 3 seconds).
 * No account, name or email is asked.
 */
const PAGES: { title: string; line: string; show: 'estimate' | 'convert' | 'sign' | 'receipt' }[] = [
  { title: 'Estimates that look like your business.', line: 'Your name, logo and prices on a clean PDF.', show: 'estimate' },
  { title: 'Turn a yes into an invoice.', line: 'One tap carries every line over.', show: 'convert' },
  { title: 'Get it signed on the spot.', line: 'Your client signs on your phone.', show: 'sign' },
  { title: 'Paid. Send the receipt.', line: 'The payment and the balance on one page.', show: 'receipt' },
];

interface TrialOffer {
  length: string;
  then: string;
}

let offerPromise: Promise<TrialOffer | null> | null = null;

async function loadTrialOffer(): Promise<TrialOffer | null> {
  const off = await getOffering();
  const pkg = off?.weekly;
  if (!pkg) return null;
  if (!trialLabel(pkg, await getTrialEligibleIds([pkg]))) return null;
  const length = trialLength(pkg.product.introPrice);
  if (!length) return null;
  return { length, then: `${pkg.product.priceString} a week` };
}

/** Starts the eligibility check early; it is ready long before the trial screen. */
function trialOffer(): Promise<TrialOffer | null> {
  if (!offerPromise) offerPromise = loadTrialOffer().catch(() => null);
  return offerPromise;
}

export default function Welcome({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const [step, setStep] = useState(0);
  useEffect(() => {
    trialOffer();
  }, []);
  const { width, height } = useWindowDimensions();
  const next = () => (step < PAGES.length - 1 ? setStep(step + 1) : onDone());
  const p = PAGES[step];
  const w = width - space.l * 2;
  const h = Math.round(Math.min(height * 0.42, w * 1.05));
  const visual =
    p.show === 'estimate' ? <EstimateShow theme={theme} width={w} height={h} /> : p.show === 'convert' ? <ConvertShow theme={theme} width={w} /> : p.show === 'sign' ? <SignShow theme={theme} width={w} /> : <ReceiptShow theme={theme} width={w} height={h} />;
  return <Page key={step} theme={theme} title={p.title} line={p.line} visual={visual} dots={{ count: PAGES.length, active: step }} button="Continue" onPress={next} />;
}

/**
 * The first estimate, before any paywall: the business name and one line,
 * then that estimate as its PDF will look. It is saved as a draft, and the
 * name goes into the business profile. Skip is fine.
 */
export function FirstEstimate({ onDone }: { onDone: (docId: string | null) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const data = useData();
  const { width } = useWindowDimensions();
  const [name, setName] = useState(data.business.name);
  const [what, setWhat] = useState('');
  const [price, setPrice] = useState('');
  const [doc, setDoc] = useState<Doc | null>(null);
  const [saving, setSaving] = useState(false);
  const mark = decimalMark(data.locale.tag);
  const ready = name.trim().length > 0 && what.trim().length > 0 && (parseAmount(price, mark) ?? 0) > 0;

  const make = async () => {
    setSaving(true);
    try {
      await data.saveBusiness({ ...data.business, name: name.trim() });
      const d = await data.newDoc('estimate');
      const made: Doc = { ...d, lines: [{ ...d.lines[0], description: what.trim(), qty: 1, rate: parseAmount(price, mark) ?? 0 }] };
      await data.saveDoc(made);
      setDoc(made);
    } finally {
      setSaving(false);
    }
  };

  if (doc) {
    const w = width - space.l * 2;
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, paddingBottom: Math.max(insets.bottom, space.l) }]}>
        <View style={styles.visual}>
          <PageWindow theme={theme} doc={doc} business={{ ...data.business, name: name.trim() }} ownerSignature={previewSignature('own', data.signature, [])} width={w} height={Math.round(w * 1.0)} zoom={1.0} top={0} accent={data.defaults.accent} locale={data.locale.tag} label={`Your first estimate, ${doc.number}, from ${name.trim()}`} />
        </View>
        <View style={styles.wordsUnder}>
          <Text style={[type.title, { color: theme.ink }]} accessibilityRole="header">
            Your first estimate.
          </Text>
          <Text style={[type.body, styles.line, { color: theme.inkSoft }]}>Saved as a draft. Add a client and your logo, then send it.</Text>
        </View>
        <View style={styles.footer}>
          <InkButton theme={theme} label="Continue" onPress={() => onDone(doc.id)} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.listPage} keyboardShouldPersistTaps="handled">
        <Text style={[type.title, { color: theme.ink }]} accessibilityRole="header">
          Make your first estimate.
        </Text>
        <Text style={[type.body, styles.line, { color: theme.inkSoft }]}>Two things, and you see the PDF.</Text>
        <Section theme={theme} style={{ marginTop: space.xl }}>
          <InputRow theme={theme} first label="Business" value={name} onChangeText={setName} placeholder="Your business name" autoCapitalize="words" autoFocus />
          <InputRow theme={theme} label="Work" value={what} onChangeText={setWhat} placeholder="Replace kitchen faucet" />
          <InputRow theme={theme} label="Price" value={price} onChangeText={setPrice} placeholder={`250${mark}00`} keyboardType="decimal-pad" style={{ textAlign: 'right' }} />
        </Section>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.l) }]}>
        <InkButton theme={theme} label="See the estimate" onPress={make} disabled={!ready} busy={saving} />
        <Tap onPress={() => onDone(null)} accessibilityRole="button" style={styles.skip}>
          <Text style={[type.body, { color: theme.inkSoft, textAlign: 'center' }]}>Skip for now</Text>
        </Tap>
      </View>
    </KeyboardAvoidingView>
  );
}

/** The trial and reminder screens. Calls onDone right away when no trial is on offer. */
export function TrialSteps({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const [offer, setOffer] = useState<TrialOffer | null | undefined>(undefined);
  const [step, setStep] = useState<'trial' | 'remind'>('trial');
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    let live = true;
    trialOffer().then((o) => {
      if (!live) return;
      if (o) setOffer(o);
      else onDone();
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!offer) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center' }]}>
        <ActivityIndicator color={theme.inkSoft} />
      </View>
    );
  }

  if (step === 'trial') {
    return (
      <Page
        theme={theme}
        title={`Try it free for ${offer.length}.`}
        line={`Then ${offer.then}. Cancel in Settings any time before it ends.`}
        button="Try it free"
        onPress={() => setStep('remind')}
        noPayment
        visual={
          <Panel theme={theme} style={{ alignSelf: 'stretch' }}>
            <Row theme={theme} first glyph="check" label="Today" sub="Share, mail and print every PDF you make." />
            <Row theme={theme} glyph="date" label="The day before it ends" sub="One reminder, so nothing surprises you." />
            <Row theme={theme} glyph="star" label={`After ${offer.length}`} sub={`${offer.then[0].toUpperCase()}${offer.then.slice(1)}. Cancel before then and pay nothing.`} />
          </Panel>
        }
      />
    );
  }

  return (
    <Page
      theme={theme}
      title="We’ll remind you the day before it ends."
      line="It is the only notification the app sends."
      button="Continue"
      waiting={waiting}
      onPress={async () => {
        setWaiting(true);
        await requestReminderPermission();
        setWaiting(false);
        onDone();
      }}
    />
  );
}

/** One idea per screen: one large line, one line under it, the dots and the button. */
function Page({
  theme,
  title,
  line,
  dots,
  button,
  onPress,
  waiting = false,
  noPayment = false,
  visual,
}: {
  theme: Theme;
  title: string;
  line?: string;
  /** The product, shown above the words. */
  visual?: React.ReactNode;
  dots?: { count: number; active: number };
  button: string;
  onPress: () => void;
  waiting?: boolean;
  noPayment?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingBottom: Math.max(insets.bottom, space.l) }]}>
      {visual ? <View style={styles.visual}>{visual}</View> : null}
      <View style={visual ? styles.wordsUnder : styles.words}>
        <Text style={[type.title, { color: theme.ink }]} accessibilityRole="header">
          {title}
        </Text>
        {line ? <Text style={[type.body, styles.line, { color: theme.inkSoft }]}>{line}</Text> : null}
      </View>
      {dots && (
        <View style={styles.dots} accessible accessibilityLabel={`Page ${dots.active + 1} of ${dots.count}`}>
          {Array.from({ length: dots.count }, (_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === dots.active ? theme.ink : theme.rule }, i === dots.active && styles.dotOn]} />
          ))}
        </View>
      )}
      <View style={styles.footer}>
        {waiting ? <ActivityIndicator color={theme.inkSoft} style={styles.waiting} /> : <InkButton theme={theme} label={button} onPress={onPress} />}
        {noPayment && (
          <View style={styles.noPaymentRow}>
            <Glyph name="check" size={18} color={theme.ink} weight={2.2} />
            <Text style={[type.strong, { color: theme.ink }]}>No payment now</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  words: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl },
  visual: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.l, paddingTop: space.xl },
  wordsUnder: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.xl },
  listPage: { flex: 1, paddingTop: space.xxl, paddingHorizontal: space.l },
  line: { marginTop: space.m },
  need: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 68, paddingHorizontal: space.l, paddingVertical: space.m },
  radio: { width: 24, height: 24, borderRadius: radius.round, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: radius.round },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.s, marginBottom: space.l },
  dot: { width: space.s, height: space.s, borderRadius: radius.round },
  dotOn: { width: space.xl },
  footer: { paddingHorizontal: space.l, gap: space.m, paddingTop: space.m },
  waiting: { height: 64 },
  skip: { minHeight: 44, justifyContent: 'center' },
  noPaymentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s },
});
