/**
 * The onboarding screens' pictures: the product itself, drawn by the app's
 * own renderers (the PDF layout through Skia, the real list rows, the pen
 * engine playing a signature in). Sample content only (src/sampleDoc.ts).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Theme, radius, space, type } from '../theme';
import { pagesFor, pdfKit, PdfKit } from '../pdfAssets';
import { SAMPLE_BUSINESS, sampleDoc } from '../sampleDoc';
import { SAMPLE_SIGNATURE } from '../sample';
import { ACCENTS } from '../settings';
import type { Doc } from '../model';
import type { Business } from '../settings';
import { formatMoney } from '../format';
import { docTotals, rowOf } from '../docs';
import PageView from './PageView';
import { PlayInk } from './InkView';
import { DocLine } from '../screens/Documents';
import Glyph from './Glyph';

export function useKit(): PdfKit | null {
  const [kit, setKit] = useState<PdfKit | null>(null);
  useEffect(() => {
    let live = true;
    pdfKit()
      .then((k) => live && setKit(k))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return kit;
}

/** A window onto part of a page: `zoom` times the box width, from `top` (a share of the page height). */
export function PageWindow({ theme, doc, business = SAMPLE_BUSINESS, width, height, zoom = 1, top = 0, left = 0, accent = ACCENTS[0].hex, locale = 'en-US', label }: { theme: Theme; doc: Doc; business?: Business; width: number; height: number; zoom?: number; top?: number; left?: number; accent?: string; locale?: string; label: string }) {
  const kit = useKit();
  const pages = useMemo(() => (kit ? pagesFor(kit, { doc, business, logo: null, ownerSignature: { strokes: SAMPLE_SIGNATURE, width: 361, height: 232 }, template: 'ledger', accent, paper: 'letter', locale }) : null), [kit, doc, business, accent, locale]);
  const pageW = width * zoom;
  return (
    <View style={[styles.window, { width, height, backgroundColor: '#FFFFFF', borderColor: theme.edge }]} accessible accessibilityRole="image" accessibilityLabel={label}>
      {pages && kit ? (
        <View style={{ marginTop: -top * pageW * (pages[0].height / pages[0].width), marginLeft: -left * pageW }}>
          <PageView page={pages[0]} width={pageW} faces={kit.faces} logoBase64={null} label={label} />
        </View>
      ) : null}
    </View>
  );
}

/** 1: an estimate's top half, with the business, the type and the first lines. */
export function EstimateShow({ theme, width, height }: { theme: Theme; width: number; height: number }) {
  return <PageWindow theme={theme} doc={sampleDoc('estimate')} width={width} height={height} zoom={1.08} top={0.02} left={0.02} label="An estimate with the business name, number, client and lines" />;
}

/** 2: the list as it looks after one tap: the estimate accepted and its invoice. */
export function ConvertShow({ theme, width }: { theme: Theme; width: number }) {
  const est = sampleDoc('estimate', { status: 'accepted' });
  const inv = sampleDoc('invoice', { paid: 0, status: 'draft', sourceId: est.id, id: 'inv' });
  return (
    <View style={{ width, gap: space.l }}>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.edge }]}>
        <DocLine theme={theme} row={rowOf(est)} first={false} today="2026-11-17" locale="en-US" onPress={() => {}} />
      </View>
      <View style={styles.arrow}>
        <Glyph name="convert" size={22} color={theme.inkSoft} />
        <Text style={[type.small, { color: theme.inkSoft }]}>Make invoice</Text>
      </View>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.edge }]}>
        <DocLine theme={theme} row={rowOf(inv)} first={false} today="2026-11-17" locale="en-US" onPress={() => {}} />
      </View>
    </View>
  );
}

/** 3: a client's signature drawing itself in over the total. */
export function SignShow({ theme, width }: { theme: Theme; width: number }) {
  const total = docTotals(sampleDoc('estimate')).total;
  const h = Math.round(width * 0.5);
  return (
    <View style={{ width, gap: space.m }}>
      <View>
        <Text style={[type.small, { color: theme.inkSoft }]}>Estimate EST-0042 for Dana Ruiz</Text>
        <Text style={[type.figure, { color: theme.ink }]}>{formatMoney(total, 'USD', 'en-US')}</Text>
      </View>
      <View style={[styles.pad, { width, height: h, backgroundColor: theme.sheet, borderColor: theme.edge }]}>
        <View style={[styles.line, { top: h * 0.72, backgroundColor: theme.baseline }]} />
        <PlayInk strokes={SAMPLE_SIGNATURE} width={width} height={h} color="#1A1A1E" margin={24} />
      </View>
    </View>
  );
}

/** 4: a receipt's totals with the PAID stamp. */
export function ReceiptShow({ theme, width, height }: { theme: Theme; width: number; height: number }) {
  return <PageWindow theme={theme} doc={sampleDoc('receipt', { notes: '', lines: sampleDoc('receipt').lines.slice(0, 2) })} width={width} height={height} zoom={1.1} top={0.16} left={0} accent={ACCENTS[2].hex} label="A receipt with the amount paid and a paid stamp" />;
}

const styles = StyleSheet.create({
  window: { borderWidth: 1, overflow: 'hidden', borderRadius: radius.small },
  card: { borderWidth: 1, borderRadius: radius.large, overflow: 'hidden' },
  arrow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s },
  pad: { borderWidth: 1, borderRadius: radius.large, overflow: 'hidden' },
  line: { position: 'absolute', left: space.xl, right: space.xl, height: 1 },
});
