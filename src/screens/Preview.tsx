import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTheme, radius, space, type } from '../theme';
import { useData } from '../data';
import { useApp } from '../state';
import type { Doc } from '../model';
import { TYPE_LABEL } from '../model';
import { ACCENTS, TEMPLATES } from '../settings';
import { exportDecision, freeExportsLeft } from '../gates';
import { pagesFor, pdfBytes, pdfKit, PdfKit } from '../pdfAssets';
import { canMail, mailPdf, pdfFileName, printPdf, sharePdf, writePdf } from '../exporting';
import { maybeRequestReview } from '../reviews';
import PageView from '../ui/PageView';
import { Caption, InkButton, QuietButton, Tap, TopBar } from '../ui/Kit';
import { Choice } from '../ui/Form';
import { savedHaptic, tick } from '../ui/motion';

type Way = 'share' | 'mail' | 'print';

/**
 * The page as it will print, with the template and color, and the three
 * ways out: the share sheet, Mail with the PDF attached, and Print.
 */
export default function Preview({ id, onBack, onBusiness }: { id: string; onBack: () => void; onBusiness: () => void }) {
  const theme = useTheme();
  const data = useData();
  const app = useApp();
  const { width } = useWindowDimensions();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [kit, setKit] = useState<PdfKit | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<Way | null>(null);
  const { defaults } = data;

  useEffect(() => {
    data.getDoc(id).then(setDoc);
    pdfKit()
      .then(setKit)
      .catch((e) => setFailed(e?.message ?? 'The preview did not load.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const pages = useMemo(() => {
    if (!doc || !kit) return null;
    return pagesFor(kit, { doc, business: data.business, logo: data.logo, ownerSignature: data.signature, template: defaults.template, accent: defaults.accent, paper: defaults.paper, locale: data.locale.tag });
  }, [doc, kit, data.business, data.logo, data.signature, defaults.template, defaults.accent, defaults.paper, data.locale.tag]);

  const left = freeExportsLeft(app.isPro, app.freeExports);

  const send = async (way: Way) => {
    if (!doc || !kit || !pages || busy) return;
    if (!data.business.name.trim()) {
      Alert.alert('Add your business name first', 'It prints at the top of every document.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Add it', onPress: onBusiness },
      ]);
      return;
    }
    let decision = exportDecision(app.isPro, app.freeExports, doc.id);
    if (!decision.allowed) {
      const pro = await app.askPro('export');
      if (!pro) return;
      decision = { allowed: true, usesFree: false };
    }
    setBusy(way);
    try {
      const bytes = await pdfBytes(kit, pages, data.logo, { type: doc.type, number: doc.number, business: data.business.name, client: doc.client.name });
      const name = pdfFileName([TYPE_LABEL[doc.type], doc.number, doc.client.name]);
      const uri = writePdf(name, bytes);
      let out = true;
      if (way === 'share') await sharePdf(uri, name);
      else if (way === 'print') await printPdf(uri);
      else if (await canMail()) {
        const greeting = doc.client.name.trim() ? `Hi ${doc.client.name.trim().split(/\s+/)[0]},` : 'Hello,';
        const res = await mailPdf(uri, {
          to: doc.client.email.trim() || undefined,
          subject: `${TYPE_LABEL[doc.type]} ${doc.number} from ${data.business.name.trim()}`,
          body: `${greeting}\n\nYour ${TYPE_LABEL[doc.type].toLowerCase()} is attached.\n\n${data.business.name.trim()}${data.business.phone ? `\n${data.business.phone}` : ''}`,
        });
        out = res === 'sent' || res === 'saved';
      } else {
        await sharePdf(uri, name);
      }
      if (decision.usesFree && out) app.noteFreeExport(doc.id);
      // A draft that went out is sent.
      if (doc.status === 'draft' && out) {
        await data.setStatus(doc.id, 'sent');
        setDoc({ ...doc, status: 'sent' });
      }
      if (out) {
        savedHaptic();
        maybeRequestReview('firstExport');
      }
    } catch (e: any) {
      if (!/cancel/i.test(String(e?.message))) Alert.alert('The PDF did not go out', e?.message ?? 'Try once more.');
    } finally {
      setBusy(null);
    }
  };

  const pageW = width - space.l * 2;

  return (
    <View style={{ flex: 1 }}>
      <TopBar theme={theme} title={doc ? `${TYPE_LABEL[doc.type]} ${doc.number}` : 'Preview'} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Choice
          theme={theme}
          label="Template"
          options={TEMPLATES.map((t) => ({ id: t.id, label: t.label }))}
          value={defaults.template}
          onChange={(template) => data.saveDefaults({ ...defaults, template })}
        />
        <View style={styles.accents} accessibilityRole="radiogroup" accessibilityLabel="Color">
          {ACCENTS.map((a) => {
            const on = a.hex === defaults.accent;
            return (
              <Tap
                key={a.hex}
                onPress={() => {
                  tick();
                  data.saveDefaults({ ...defaults, accent: a.hex });
                }}
                accessibilityRole="radio"
                accessibilityLabel={a.label}
                accessibilityState={{ selected: on }}
                style={[styles.dotWrap, { borderColor: on ? theme.ink : 'transparent' }]}
              >
                <View style={[styles.dot, { backgroundColor: a.hex, borderColor: theme.inkFaint }]} />
              </Tap>
            );
          })}
        </View>
        {failed ? <Text style={[type.body, { color: theme.danger }]}>{failed}</Text> : null}
        {!pages || !kit ? (
          <View style={[styles.loading, { width: pageW, height: pageW * 1.29, backgroundColor: theme.sheet, borderColor: theme.edge }]}>
            <ActivityIndicator color={theme.inkSoft} />
          </View>
        ) : (
          pages.map((p, i) => (
            <View key={i} style={[styles.sheet, { borderColor: theme.edge }]}>
              <PageView page={p} width={pageW} faces={kit.faces} logoBase64={data.logo?.base64 ?? null} label={`Page ${i + 1} of ${pages.length}`} />
            </View>
          ))
        )}
      </ScrollView>
      <View style={[styles.bottom, { borderTopColor: theme.edge, backgroundColor: theme.bg }]}>
        <InkButton theme={theme} glyph="share" label={busy === 'share' ? 'Making the PDF' : 'Share PDF'} onPress={() => send('share')} disabled={!pages || busy != null} />
        <View style={styles.row}>
          <QuietButton theme={theme} grow glyph="mail" label={busy === 'mail' ? 'One moment' : 'Mail'} onPress={() => send('mail')} disabled={!pages || busy != null} />
          <QuietButton theme={theme} grow glyph="print" label={busy === 'print' ? 'One moment' : 'Print'} onPress={() => send('print')} disabled={!pages || busy != null} />
        </View>
        {left != null && doc && !app.freeExports.includes(doc.id) ? (
          <Caption theme={theme} style={{ textAlign: 'center' }}>
            {left > 0 ? `${left} free ${left === 1 ? 'PDF' : 'PDFs'} left. Drafts stay free.` : 'Sending more PDFs is part of Pro. Your documents stay here and stay free to edit.'}
          </Caption>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.l, gap: space.l, paddingBottom: space.xxl },
  accents: { flexDirection: 'row', gap: space.s },
  dotWrap: { width: 44, height: 44, borderRadius: radius.round, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 30, height: 30, borderRadius: radius.round, borderWidth: 1 },
  sheet: { borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  loading: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { paddingHorizontal: space.l, paddingTop: space.m, paddingBottom: space.m, gap: space.s, borderTopWidth: 1 },
  row: { flexDirection: 'row', gap: space.s },
});
