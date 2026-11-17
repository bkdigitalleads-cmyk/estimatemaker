import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTheme, space, type, tabular } from '../theme';
import { useData } from '../data';
import { useApp } from '../state';
import type { Doc } from '../model';
import { TYPE_LABEL } from '../model';
import { formatMoney } from '../format';
import { docTotals } from '../docs';
import { compactStroke, hasInk, Stroke } from '../stroke';
import Pad from '../ui/Pad';
import { Field, GlyphButton, InkButton, TopBar } from '../ui/Kit';
import { savedHaptic } from '../ui/motion';

const INK = '#1A1A1E';

function usePad() {
  const { width, height } = useWindowDimensions();
  const w = width - space.l * 2;
  const h = Math.round(Math.max(200, Math.min(300, height * 0.32)));
  return { w, h };
}

function PadTools({ strokes, setStrokes }: { strokes: Stroke[]; setStrokes: (s: Stroke[]) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.tools}>
      <GlyphButton theme={theme} glyph="undo" label="Undo" disabled={strokes.length === 0} onPress={() => setStrokes(strokes.slice(0, -1))} filled />
      <GlyphButton theme={theme} glyph="clear" label="Clear" disabled={strokes.length === 0} onPress={() => setStrokes([])} filled />
    </View>
  );
}

/**
 * Sign here: the phone goes to the client. The total sits above the pad so
 * they know what they are agreeing to; their name goes under it.
 */
export function SignHere({ docId, onBack }: { docId: string; onBack: () => void }) {
  const theme = useTheme();
  const data = useData();
  const { setSigning } = useApp();
  const { w, h } = usePad();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [name, setName] = useState('');

  useEffect(() => {
    setSigning(true);
    data.getDoc(docId).then((d) => {
      setDoc(d);
      if (d) setName(d.client.name);
    });
    return () => setSigning(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  if (!doc) return <View style={{ flex: 1 }} />;
  const total = docTotals(doc).total;
  const done = async () => {
    await data.saveDoc({ ...doc, clientSigned: { strokes: strokes.map(compactStroke), width: w, height: h, name: name.trim(), at: Date.now() }, status: doc.status === 'draft' || doc.status === 'sent' ? (doc.type === 'invoice' ? doc.status : 'accepted') : doc.status });
    savedHaptic();
    onBack();
  };
  return (
    <View style={{ flex: 1 }}>
      <TopBar theme={theme} title="Sign here" onBack={onBack} closeGlyph="close" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" scrollEnabled={false}>
        <View>
          <Text style={[type.small, { color: theme.inkSoft }]}>
            {TYPE_LABEL[doc.type]} {doc.number}
            {doc.client.name ? ` for ${doc.client.name}` : ''}
          </Text>
          <Text style={[type.title, tabular, { color: theme.ink }]}>{formatMoney(total, doc.currency, data.locale.tag)}</Text>
        </View>
        <Pad theme={theme} width={w} height={h} strokes={strokes} onStroke={(s) => setStrokes([...strokes, s])} pen="ink" size={1} inkHex={INK} placeholder="Sign with a finger" />
        <PadTools strokes={strokes} setStrokes={setStrokes} />
        <Field theme={theme} value={name} onChangeText={setName} placeholder="Name of the person signing" accessibilityLabel="Name of the person signing" autoCapitalize="words" />
        <InkButton theme={theme} label="Done" onPress={done} disabled={!hasInk(strokes)} hint="Saves the signature on this document" />
      </ScrollView>
    </View>
  );
}

/** The business owner's signature: drawn once, printed on every document that asks for it. */
export function MySignature({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const data = useData();
  const { w, h } = usePad();
  const [strokes, setStrokes] = useState<Stroke[]>(() => (data.signature && Math.abs(data.signature.width - w) < 1 ? data.signature.strokes : []));
  const save = async () => {
    await data.saveSignature({ strokes: strokes.map(compactStroke), width: w, height: h });
    savedHaptic();
    onBack();
  };
  return (
    <View style={{ flex: 1 }}>
      <TopBar theme={theme} title="Your signature" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scroll} scrollEnabled={false}>
        <Text style={[type.body, { color: theme.inkSoft }]}>It goes on the business line of your documents. Turn it off on any one of them.</Text>
        <Pad theme={theme} width={w} height={h} strokes={strokes} onStroke={(s) => setStrokes([...strokes, s])} pen="ink" size={1} inkHex={INK} />
        <PadTools strokes={strokes} setStrokes={setStrokes} />
        <InkButton theme={theme} label="Save signature" onPress={save} disabled={!hasInk(strokes)} />
        {data.signature ? (
          <Text
            style={[type.small, styles.remove, { color: theme.danger }]}
            accessibilityRole="button"
            onPress={() =>
              Alert.alert('Remove your signature?', 'Documents will print an empty signature line.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: async () => {
                    await data.saveSignature(null);
                    onBack();
                  },
                },
              ])
            }
          >
            Remove my signature
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.l, gap: space.l },
  tools: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.s, marginTop: -space.s },
  remove: { textAlign: 'center', textDecorationLine: 'underline', paddingVertical: space.s },
});
