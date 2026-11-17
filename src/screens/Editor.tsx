import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme, radius, space, tabular, type, Theme } from '../theme';
import { useData } from '../data';
import type { Client, Item } from '../db/repo';
import { blankLine, convertTargets, Doc, dueLabel, Line, newId, paidLabel, STATUS_LABEL, statusesFor, TYPE_LABEL } from '../model';
import { docTotals } from '../docs';
import { formatDate, formatMoney, formatNumber } from '../format';
import { addDays, daysBetween, isoDay } from '../dates';
import { lineAmount } from '../money';
import { stepFor } from '../docs';
import Glyph from '../ui/Glyph';
import { Caption, Drawer, Field, GlyphButton, InkButton, Label, Panel, QuietButton, Row, Tap, TopBar } from '../ui/Kit';
import { Choice, DateSheet, InputRow, MoneyRow, NumberRow, Section, SwitchRow, ValueRow } from '../ui/Form';
import { InkView } from '../ui/InkView';
import { tick } from '../ui/motion';

type Sheet = null | 'client' | 'issue' | 'due' | 'items' | 'more' | 'number' | { line: Line; isNew: boolean };

/**
 * One document, every field on one scrolling page, saved as you go.
 * Preview and send at the bottom, and the one-tap convert beside it.
 */
export default function Editor({
  id,
  onBack,
  onPreview,
  onSignHere,
  onOwnerSignature,
  onOpen,
}: {
  id: string;
  onBack: () => void;
  onPreview: (id: string) => void;
  onSignHere: (id: string) => void;
  onOwnerSignature: () => void;
  onOpen: (id: string) => void;
}) {
  const theme = useTheme();
  const data = useData();
  const { locale, clients, items, signature, defaults } = data;
  const [doc, setDoc] = useState<Doc | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const dirty = useRef(false);
  const latest = useRef<Doc | null>(null);
  latest.current = doc;

  useEffect(() => {
    let live = true;
    data.getDoc(id).then((d) => live && setDoc(d));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Saved as you go: a moment after the last change, and when leaving.
  const flush = useCallback(async () => {
    if (!dirty.current || !latest.current) return;
    dirty.current = false;
    await data.saveDoc(latest.current);
  }, [data]);
  useEffect(() => {
    if (!doc || !dirty.current) return;
    const t = setTimeout(flush, 400);
    return () => clearTimeout(t);
  }, [doc, flush]);
  useEffect(() => () => void flush(), [flush]);

  const edit = (patch: Partial<Doc>) => {
    dirty.current = true;
    setDoc((d) => (d ? { ...d, ...patch } : d));
  };

  const totals = useMemo(() => (doc ? docTotals(doc) : null), [doc]);

  if (!doc || !totals) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={theme.inkSoft} />
      </View>
    );
  }

  const money = (v: number) => formatMoney(v, doc.currency, locale.tag);
  const back = async () => {
    await flush();
    onBack();
  };
  const due = dueLabel(doc.type);
  const target = convertTargets(doc.type)[0];

  const setLine = (line: Line) => edit({ lines: doc.lines.some((l) => l.id === line.id) ? doc.lines.map((l) => (l.id === line.id ? line : l)) : [...doc.lines, line] });
  const removeLine = (lineId: string) => edit({ lines: doc.lines.filter((l) => l.id !== lineId) });
  const moveLine = (lineId: string, dir: -1 | 1) => {
    const i = doc.lines.findIndex((l) => l.id === lineId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= doc.lines.length) return;
    const next = doc.lines.slice();
    [next[i], next[j]] = [next[j], next[i]];
    edit({ lines: next });
  };
  const pickClient = (c: Client | null) => {
    setSheet(null);
    edit(c ? { clientId: c.id, client: { name: c.name, email: c.email, phone: c.phone, address: c.address } } : { clientId: null, client: { name: '', email: '', phone: '', address: '' } });
  };
  const addItem = (it: Item) => {
    setSheet(null);
    const blankOnly = doc.lines.length === 1 && !doc.lines[0].description && !doc.lines[0].rate;
    const line: Line = { id: newId(Date.now()), description: it.description, qty: 1, unit: it.unit, rate: it.rate, taxable: it.taxable };
    edit({ lines: blankOnly ? [line] : [...doc.lines, line] });
  };

  const convert = async () => {
    if (!target) return;
    await flush();
    const made = await data.convert(doc.id, target);
    if (made) onOpen(made.id);
  };
  const duplicate = async () => {
    setSheet(null);
    await flush();
    const made = await data.duplicate(doc.id);
    if (made) onOpen(made.id);
  };
  const remove = () => {
    setSheet(null);
    Alert.alert(`Delete ${TYPE_LABEL[doc.type].toLowerCase()} ${doc.number}?`, 'It goes from this iPhone. PDFs you already sent are not affected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          dirty.current = false;
          await data.removeDoc(doc.id);
          onBack();
        },
      },
    ]);
  };

  const today = isoDay(Date.now());

  return (
    <View style={{ flex: 1 }}>
      <TopBar theme={theme} title={`${TYPE_LABEL[doc.type]} ${doc.number}`} onBack={back} right={<GlyphButton theme={theme} glyph="more" label="More: duplicate, delete, number" onPress={() => setSheet('more')} />} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        {statusesFor(doc.type).length > 1 ? (
          <Choice theme={theme} label="Status" options={statusesFor(doc.type).map((s) => ({ id: s, label: STATUS_LABEL[s] }))} value={doc.status} onChange={(status) => edit({ status })} />
        ) : null}

        <Section theme={theme} label="Client">
          {doc.client.name ? (
            <Tap onPress={() => setSheet('client')} style={styles.client} pressedStyle={{ backgroundColor: theme.raised }} accessibilityRole="button" accessibilityLabel={`Client ${doc.client.name}. Change`}>
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { color: theme.ink }]}>{doc.client.name}</Text>
                {[doc.client.address.split('\n')[0], doc.client.email || doc.client.phone].filter(Boolean).map((t, i) => (
                  <Text key={i} style={[type.small, { color: theme.inkSoft }]} numberOfLines={1}>
                    {t}
                  </Text>
                ))}
              </View>
              <Glyph name="chevron" size={16} color={theme.inkFaint} />
            </Tap>
          ) : (
            <Row theme={theme} first glyph="client" label="Pick a client" onPress={() => setSheet('client')} />
          )}
        </Section>

        <Section theme={theme} label="Dates">
          <ValueRow theme={theme} first label={doc.type === 'receipt' ? 'Paid on' : 'Date'} value={formatDate(doc.issueDate, locale.tag)} onPress={() => setSheet('issue')} />
          {due ? <ValueRow theme={theme} label={due} value={doc.dueDate ? formatDate(doc.dueDate, locale.tag) : ''} placeholder="None" onPress={() => setSheet('due')} /> : null}
        </Section>

        <View>
          <Label theme={theme}>Work and materials</Label>
          <Panel theme={theme}>
            {doc.lines.map((l, i) => (
              <Tap
                key={l.id}
                onPress={() => setSheet({ line: l, isNew: false })}
                style={[styles.line, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.rule }]}
                pressedStyle={{ backgroundColor: theme.raised }}
                accessibilityRole="button"
                accessibilityLabel={`${l.description || 'Empty line'}, ${formatNumber(l.qty, locale.tag)} at ${money(l.rate)}, ${money(lineAmount(l, stepFor(doc.currency)))}. Edit`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { color: l.description ? theme.ink : theme.inkFaint }]} numberOfLines={2}>
                    {l.description || 'Describe the work'}
                  </Text>
                  <Text style={[type.small, tabular, { color: theme.inkSoft }]}>
                    {formatNumber(l.qty, locale.tag)}
                    {l.unit ? ` ${l.unit}` : ''} × {money(l.rate)}
                    {l.taxable && doc.taxRate > 0 ? '' : doc.taxRate > 0 ? `, no ${doc.taxLabel.toLowerCase()}` : ''}
                  </Text>
                </View>
                <Text style={[type.body, tabular, { color: theme.ink }]}>{money(totals.lineAmounts[i])}</Text>
              </Tap>
            ))}
          </Panel>
          <View style={styles.lineButtons}>
            <QuietButton theme={theme} grow glyph="plus" label="Add line" onPress={() => setSheet({ line: { ...blankLine(newId(Date.now())), taxable: true }, isNew: true })} />
            <QuietButton theme={theme} grow glyph="items" label="Saved items" onPress={() => setSheet('items')} />
          </View>
        </View>

        <Section theme={theme} label="Totals">
          <View style={[styles.sumRow]}>
            <Text style={[type.body, { color: theme.inkSoft, flex: 1 }]}>Subtotal</Text>
            <Text style={[type.body, tabular, { color: theme.ink }]}>{money(totals.subtotal)}</Text>
          </View>
          <View style={[styles.discount, { borderTopColor: theme.rule }]}>
            <Text style={[type.body, { color: theme.inkSoft }]}>Discount</Text>
            <Choice
              theme={theme}
              options={[
                { id: 'percent', label: '%' },
                { id: 'amount', label: 'Amount' },
              ]}
              value={doc.discountKind}
              onChange={(discountKind) => edit({ discountKind, discountValue: 0 })}
            />
          </View>
          {doc.discountKind === 'percent' ? (
            <NumberRow theme={theme} label="Percent off" value={doc.discountValue} onValue={(discountValue) => edit({ discountValue })} locale={locale.tag} suffix="%" allowEmpty />
          ) : (
            <MoneyRow theme={theme} label="Amount off" value={doc.discountValue} onValue={(discountValue) => edit({ discountValue })} currency={doc.currency} locale={locale.tag} />
          )}
          <NumberRow theme={theme} label={`${doc.taxLabel} rate`} value={doc.taxRate} onValue={(taxRate) => edit({ taxRate })} locale={locale.tag} suffix="%" allowEmpty />
          {totals.discount > 0 ? <SumLine theme={theme} label="Discount" value={`-${money(totals.discount)}`} /> : null}
          {doc.taxRate > 0 ? <SumLine theme={theme} label={`${doc.taxLabel} ${formatNumber(doc.taxRate, locale.tag)}%`} value={money(totals.tax)} /> : null}
          <SumLine theme={theme} label="Total" value={money(totals.total)} strong />
          <MoneyRow theme={theme} label={paidLabel(doc.type)} value={doc.paid} onValue={(paid) => edit({ paid })} currency={doc.currency} locale={locale.tag} />
          {doc.type === 'receipt' ? <InputRow theme={theme} label="Paid by" value={doc.paymentNote} onChangeText={(paymentNote) => edit({ paymentNote })} placeholder="Card, cash, check 1042" /> : null}
          {doc.type !== 'receipt' || totals.balance !== 0 ? <SumLine theme={theme} label={totals.balance < 0 ? 'Credit' : 'Balance due'} value={money(Math.abs(totals.balance))} strong /> : null}
        </Section>

        <Section theme={theme} label="Notes and terms">
          <InputRow theme={theme} first multiline label="Notes" value={doc.notes} onChangeText={(notes) => edit({ notes })} placeholder="Anything the client should know" />
          <InputRow theme={theme} multiline label="Terms" value={doc.terms} onChangeText={(terms) => edit({ terms })} placeholder="Payment terms, warranty, validity" />
        </Section>
        <Tap
          onPress={async () => {
            await data.saveDefaults({ ...defaults, notes: { ...defaults.notes, [doc.type]: doc.notes }, terms: { ...defaults.terms, [doc.type]: doc.terms } });
            tick();
            Alert.alert('Saved as the default', `New ${TYPE_LABEL[doc.type].toLowerCase()}s start with these notes and terms.`);
          }}
          accessibilityRole="button"
        >
          <Caption theme={theme} style={styles.link}>
            Use these notes and terms for every new {TYPE_LABEL[doc.type].toLowerCase()}
          </Caption>
        </Tap>

        <Section theme={theme} label="Signatures">
          {signature ? (
            <SwitchRow theme={theme} first label="Sign with my signature" sub="Your saved signature on the business line" value={doc.ownerSign} onValue={(ownerSign) => edit({ ownerSign })} />
          ) : (
            <Row theme={theme} first glyph="sign" label="Add your signature" sub="Draw it once; it goes on every document" onPress={onOwnerSignature} />
          )}
          {doc.clientSigned ? (
            <View style={[styles.signed, { borderTopColor: theme.rule }]}>
              <View style={[styles.signedPaper, { backgroundColor: theme.paper, borderColor: theme.edge }]}>
                <InkView strokes={doc.clientSigned.strokes} width={140} height={52} color={theme.paperInk} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { color: theme.ink }]} numberOfLines={1}>
                  {doc.clientSigned.name || 'Client'}
                </Text>
                <Text style={[type.small, { color: theme.inkSoft }]}>Signed {formatDate(isoDay(doc.clientSigned.at), locale.tag)}</Text>
              </View>
              <GlyphButton
                theme={theme}
                glyph="trash"
                label="Remove the client's signature"
                onPress={() =>
                  Alert.alert('Remove the signature?', 'The client can sign again.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => edit({ clientSigned: null }) },
                  ])
                }
              />
            </View>
          ) : doc.type !== 'receipt' ? (
            <Row
              theme={theme}
              glyph="sign"
              label="Sign here"
              sub="Hand the phone to your client"
              onPress={async () => {
                await flush();
                onSignHere(doc.id);
              }}
            />
          ) : null}
        </Section>
        <View style={{ height: space.l }} />
      </ScrollView>

      <View style={[styles.bottom, { borderTopColor: theme.edge, backgroundColor: theme.bg }]}>
        {target ? <QuietButton theme={theme} glyph="convert" label={`Make ${TYPE_LABEL[target].toLowerCase()}`} onPress={convert} hint={`Makes a new ${TYPE_LABEL[target].toLowerCase()} with every line`} /> : null}
        <View style={{ flex: 1 }}>
          <InkButton
            theme={theme}
            label="Preview and send"
            onPress={async () => {
              await flush();
              onPreview(doc.id);
            }}
          />
        </View>
      </View>

      {/* Sheets */}
      <Drawer theme={theme} visible={sheet === 'client'} onClose={() => setSheet(null)} title="Client">
        <ClientPicker theme={theme} clients={clients} onPick={pickClient} current={doc.clientId} onCreate={async (c) => {
          await data.saveClient(c);
          pickClient(c);
        }} />
      </Drawer>
      <DateSheet
        theme={theme}
        visible={sheet === 'issue'}
        title={doc.type === 'receipt' ? 'Paid on' : 'Date'}
        value={doc.issueDate}
        locale={locale.tag}
        onClose={() => setSheet(null)}
        quick={[{ label: 'Today', iso: today }]}
        onPick={(issueDate) => {
          setSheet(null);
          // Keep the gap to the due date when the date moves.
          const gap = doc.dueDate ? daysBetween(doc.issueDate, doc.dueDate) : null;
          edit({ issueDate, dueDate: gap != null ? addDays(issueDate, gap) : doc.dueDate });
        }}
      />
      {due ? (
        <DateSheet
          theme={theme}
          visible={sheet === 'due'}
          title={due}
          value={doc.dueDate ?? doc.issueDate}
          locale={locale.tag}
          onClose={() => setSheet(null)}
          quick={(doc.type === 'invoice' ? [0, 7, 14, 30] : [14, 30, 60]).map((n) => ({ label: n === 0 ? 'On receipt' : `${n} days`, iso: addDays(doc.issueDate, n) }))}
          onPick={(dueDate) => {
            setSheet(null);
            edit({ dueDate });
          }}
        />
      ) : null}
      <Drawer theme={theme} visible={sheet === 'items'} onClose={() => setSheet(null)} title="Saved items">
        {items.length === 0 ? (
          <Text style={[type.body, { color: theme.inkSoft, paddingBottom: space.xl }]}>No saved items yet. When you add a line, turn on Save to my items and it shows up here.</Text>
        ) : (
          <Panel theme={theme} style={{ marginBottom: space.l }}>
            {items.map((it, i) => (
              <Row key={it.id} theme={theme} first={i === 0} label={it.description || 'No description'} sub={`${money(it.rate)}${it.unit ? ` per ${it.unit}` : ''}`} onPress={() => addItem(it)} right={<Glyph name="plus" size={20} color={theme.ink} />} />
            ))}
          </Panel>
        )}
      </Drawer>
      <Drawer theme={theme} visible={sheet === 'more'} onClose={() => setSheet(null)} title={`${TYPE_LABEL[doc.type]} ${doc.number}`}>
        <Panel theme={theme} style={{ marginBottom: space.l }}>
          <Row theme={theme} first glyph="pencil" label="Change the number" onPress={() => setSheet('number')} />
          <Row theme={theme} glyph="copy" label="Duplicate" sub="A new draft with the same lines and client" onPress={duplicate} />
          {target ? (
            <Row
              theme={theme}
              glyph="convert"
              label={`Make ${TYPE_LABEL[target].toLowerCase()}`}
              onPress={() => {
                setSheet(null);
                convert();
              }}
            />
          ) : null}
          <Row theme={theme} glyph="trash" tone="danger" label="Delete" onPress={remove} right={<View />} />
        </Panel>
      </Drawer>
      <Drawer theme={theme} visible={sheet === 'number'} onClose={() => setSheet(null)} title="Number">
        <NumberEditor theme={theme} value={doc.number} onDone={(number) => {
          setSheet(null);
          if (number.trim()) edit({ number: number.trim() });
        }} />
      </Drawer>
      <Drawer theme={theme} visible={typeof sheet === 'object' && sheet !== null} onClose={() => setSheet(null)} title={typeof sheet === 'object' && sheet?.isNew ? 'New line' : 'Line'}>
        {typeof sheet === 'object' && sheet ? (
          <LineEditor
            theme={theme}
            line={sheet.line}
            isNew={sheet.isNew}
            currency={doc.currency}
            locale={locale.tag}
            taxLabel={doc.taxRate > 0 ? doc.taxLabel : null}
            canMove={{ up: doc.lines.findIndex((l) => l.id === sheet.line.id) > 0, down: doc.lines.findIndex((l) => l.id === sheet.line.id) < doc.lines.length - 1 && !sheet.isNew }}
            onMove={(dir) => moveLine(sheet.line.id, dir)}
            onDone={async (line, save) => {
              setSheet(null);
              setLine(line);
              if (save && line.description.trim()) {
                const now = Date.now();
                await data.saveItem({ id: newId(now), description: line.description, rate: line.rate, unit: line.unit, taxable: line.taxable, createdAt: now, updatedAt: now });
              }
            }}
            onDelete={() => {
              setSheet(null);
              removeLine(sheet.line.id);
            }}
          />
        ) : null}
      </Drawer>
    </View>
  );
}

function SumLine({ theme, label, value, strong = false }: { theme: Theme; label: string; value: string; strong?: boolean }) {
  return (
    <View style={[styles.sumRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.rule }]} accessible accessibilityLabel={`${label}, ${value}`}>
      <Text style={[strong ? type.strong : type.body, { color: strong ? theme.ink : theme.inkSoft, flex: 1 }]}>{label}</Text>
      <Text style={[strong ? type.strong : type.body, tabular, { color: theme.ink }]}>{value}</Text>
    </View>
  );
}

function LineEditor({
  theme,
  line,
  isNew,
  currency,
  locale,
  taxLabel,
  canMove,
  onMove,
  onDone,
  onDelete,
}: {
  theme: Theme;
  line: Line;
  isNew: boolean;
  currency: string;
  locale: string;
  taxLabel: string | null;
  canMove: { up: boolean; down: boolean };
  onMove: (dir: -1 | 1) => void;
  onDone: (l: Line, saveToItems: boolean) => void;
  onDelete: () => void;
}) {
  const [l, setL] = useState(line);
  const [save, setSave] = useState(false);
  return (
    <View style={{ gap: space.l, paddingBottom: space.s }}>
      <Field theme={theme} value={l.description} onChangeText={(description) => setL({ ...l, description })} placeholder="Describe the work or the part" multiline autoFocus={isNew} accessibilityLabel="Description" style={{ minHeight: 72, paddingTop: space.m }} />
      <Panel theme={theme}>
        <NumberRow theme={theme} first label="Quantity" value={l.qty} onValue={(qty) => setL({ ...l, qty })} locale={locale} />
        <InputRow theme={theme} label="Unit" value={l.unit} onChangeText={(unit) => setL({ ...l, unit })} placeholder="hr, ea, sq ft" autoCapitalize="none" />
        <MoneyRow theme={theme} label="Rate" value={l.rate} onValue={(rate) => setL({ ...l, rate })} currency={currency} locale={locale} />
        {taxLabel ? <SwitchRow theme={theme} label={`Charge ${taxLabel.toLowerCase()}`} value={l.taxable} onValue={(taxable) => setL({ ...l, taxable })} /> : null}
        {isNew ? <SwitchRow theme={theme} label="Save to my items" sub="Use it again on the next job" value={save} onValue={setSave} /> : null}
      </Panel>
      <Text style={[type.strong, tabular, { color: theme.ink, textAlign: 'right' }]}>{formatMoney(lineAmount(l, stepFor(currency)), currency, locale)}</Text>
      <InkButton theme={theme} label={isNew ? 'Add line' : 'Done'} onPress={() => onDone(l, save)} />
      {!isNew ? (
        <View style={styles.lineButtons}>
          {canMove.up ? <QuietButton theme={theme} grow glyph="up" label="Move up" onPress={() => onMove(-1)} /> : null}
          {canMove.down ? <QuietButton theme={theme} grow glyph="down" label="Move down" onPress={() => onMove(1)} /> : null}
          <QuietButton theme={theme} grow glyph="trash" tone="danger" label="Remove" onPress={onDelete} />
        </View>
      ) : null}
    </View>
  );
}

function ClientPicker({ theme, clients, current, onPick, onCreate }: { theme: Theme; clients: Client[]; current: string | null; onPick: (c: Client | null) => void; onCreate: (c: Client) => void }) {
  const [q, setQ] = useState('');
  const shown = clients.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <View style={{ gap: space.l, paddingBottom: space.l }}>
      <Field theme={theme} value={q} onChangeText={setQ} placeholder="Find, or type a new name" accessibilityLabel="Client name" autoCapitalize="words" />
      {q.trim() && !clients.some((c) => c.name.toLowerCase() === q.trim().toLowerCase()) ? (
        <QuietButton
          theme={theme}
          glyph="plus"
          label={`Add “${q.trim()}”`}
          onPress={() => {
            const now = Date.now();
            onCreate({ id: newId(now), name: q.trim(), email: '', phone: '', address: '', notes: '', createdAt: now, updatedAt: now });
          }}
        />
      ) : null}
      {shown.length > 0 ? (
        <Panel theme={theme}>
          {shown.map((c, i) => (
            <Row key={c.id} theme={theme} first={i === 0} label={c.name || 'No name'} sub={c.address.split('\n')[0] || c.email || undefined} onPress={() => onPick(c)} right={c.id === current ? <Glyph name="check" size={20} color={theme.ink} /> : undefined} />
          ))}
        </Panel>
      ) : null}
      {current ? <QuietButton theme={theme} label="No client" onPress={() => onPick(null)} /> : null}
    </View>
  );
}

function NumberEditor({ theme, value, onDone }: { theme: Theme; value: string; onDone: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <View style={{ gap: space.l, paddingBottom: space.l }}>
      <TextInput value={v} onChangeText={setV} autoFocus autoCapitalize="characters" accessibilityLabel="Number" selectionColor={theme.accent} style={[type.body, tabular, styles.numberInput, { color: theme.ink, backgroundColor: theme.surface, borderColor: theme.edge }]} />
      <Caption theme={theme}>The next new one carries on from the highest number. Prefixes and the next number are in Settings.</Caption>
      <InkButton theme={theme} label="Done" onPress={() => onDone(v)} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.l, gap: space.xl, paddingBottom: space.xxl },
  client: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 64, paddingHorizontal: space.l, paddingVertical: space.m },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 60, paddingHorizontal: space.l, paddingVertical: space.m },
  lineButtons: { flexDirection: 'row', gap: space.s, marginTop: space.s },
  sumRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: space.l },
  discount: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, paddingHorizontal: space.l, borderTopWidth: StyleSheet.hairlineWidth },
  signed: { flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, borderTopWidth: StyleSheet.hairlineWidth },
  signedPaper: { borderWidth: 1, borderRadius: radius.small, padding: space.xs },
  link: { textDecorationLine: 'underline', marginTop: -space.m, marginLeft: space.xs },
  bottom: { flexDirection: 'row', gap: space.s, alignItems: 'center', paddingHorizontal: space.l, paddingTop: space.m, paddingBottom: space.m, borderTopWidth: 1 },
  numberInput: { minHeight: 52, borderRadius: radius.small, borderWidth: 1, paddingHorizontal: space.m, fontSize: 22 },
});
