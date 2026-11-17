import React, { useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme, space, tabular, type } from '../theme';
import { useData } from '../data';
import type { Client } from '../db/repo';
import { newId } from '../model';
import { formatMoney } from '../format';
import { isoDay } from '../dates';
import { Field, InkButton, QuietButton, Row, Title, TopBar } from '../ui/Kit';
import { InputRow, Section } from '../ui/Form';
import { DocLine } from './Documents';

/** Everyone you have worked for, A to Z, with what they owe. */
export default function Clients({ onEdit }: { onEdit: (c: Client | null) => void }) {
  const theme = useTheme();
  const { clients, rows, locale, defaults } = useData();
  const [q, setQ] = useState('');
  const owed = useMemo(() => {
    const o: Record<string, number> = {};
    for (const r of rows) if (r.clientId && r.type === 'invoice' && r.status === 'sent' && r.balance > 0 && r.currency === defaults.currency) o[r.clientId] = (o[r.clientId] ?? 0) + r.balance;
    return o;
  }, [rows, defaults.currency]);
  const shown = clients.filter((c) => `${c.name} ${c.email} ${c.phone} ${c.address}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <FlatList
      data={shown}
      keyExtractor={(c) => c.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: space.xxl }}
      ListHeaderComponent={
        <View style={styles.head}>
          <Title theme={theme}>Clients</Title>
          <InkButton theme={theme} label="New client" glyph="plus" onPress={() => onEdit(null)} />
          {clients.length > 4 ? <Field theme={theme} value={q} onChangeText={setQ} placeholder="Find a client" accessibilityLabel="Find a client" clearButtonMode="while-editing" /> : null}
        </View>
      }
      renderItem={({ item, index }) => (
        <Row
          theme={theme}
          first={index === 0}
          label={item.name || 'No name'}
          sub={[item.phone, item.email].filter(Boolean).join(' · ') || item.address.split('\n')[0] || undefined}
          onPress={() => onEdit(item)}
          right={owed[item.id] ? <Text style={[type.small, tabular, { color: theme.inkSoft }]}>owes {formatMoney(owed[item.id], defaults.currency, locale.tag)}</Text> : undefined}
        />
      )}
      ItemSeparatorComponent={null}
      ListEmptyComponent={<Text style={[type.body, styles.empty, { color: theme.inkSoft }]}>{clients.length ? 'Nobody matches.' : 'Clients you add here, or on a document, show up in this list.'}</Text>}
    />
  );
}

/** One client: their details, and every document made for them. */
export function ClientEditor({ client, onBack, onOpenDoc, onNewDoc }: { client: Client | null; onBack: () => void; onOpenDoc: (id: string) => void; onNewDoc: (c: Client) => void }) {
  const theme = useTheme();
  const data = useData();
  const now = Date.now();
  const [c, setC] = useState<Client>(client ?? { id: newId(now), name: '', email: '', phone: '', address: '', notes: '', createdAt: now, updatedAt: now });
  const theirs = data.rows.filter((r) => r.clientId === c.id);
  const save = async () => {
    if (!c.name.trim()) return Alert.alert('Add a name', 'A person or a company name, as it should print.');
    await data.saveClient({ ...c, updatedAt: Date.now() });
    onBack();
  };
  const today = isoDay(Date.now());
  return (
    <View style={{ flex: 1 }}>
      <TopBar theme={theme} title={client ? 'Client' : 'New client'} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Section theme={theme}>
          <InputRow theme={theme} first label="Name" value={c.name} onChangeText={(name) => setC({ ...c, name })} placeholder="Person or company" autoCapitalize="words" autoFocus={!client} />
          <InputRow theme={theme} label="Email" value={c.email} onChangeText={(email) => setC({ ...c, email })} placeholder="For sending by Mail" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <InputRow theme={theme} label="Phone" value={c.phone} onChangeText={(phone) => setC({ ...c, phone })} keyboardType="phone-pad" />
          <InputRow theme={theme} multiline label="Address" value={c.address} onChangeText={(address) => setC({ ...c, address })} placeholder="Street, city, postcode" />
          <InputRow theme={theme} multiline label="Private notes" value={c.notes} onChangeText={(notes) => setC({ ...c, notes })} placeholder="Gate code, best time to call. Never printed." />
        </Section>
        <InkButton theme={theme} label="Save client" onPress={save} />
        {client ? (
          <>
            <QuietButton
              theme={theme}
              glyph="plus"
              label="New estimate for this client"
              onPress={async () => {
                await data.saveClient({ ...c, updatedAt: Date.now() });
                onNewDoc(c);
              }}
            />
            {theirs.length ? (
              <View>
                {theirs.map((r, i) => (
                  <DocLine key={r.id} theme={theme} row={r} first={i === 0} today={today} locale={data.locale.tag} onPress={() => onOpenDoc(r.id)} />
                ))}
              </View>
            ) : null}
            <QuietButton
              theme={theme}
              tone="danger"
              glyph="trash"
              label="Delete client"
              onPress={() =>
                Alert.alert(`Delete ${c.name || 'this client'}?`, 'Their documents stay, with the name and address they printed.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await data.removeClient(c.id);
                      onBack();
                    },
                  },
                ])
              }
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { padding: space.l, gap: space.l },
  scroll: { padding: space.l, gap: space.xl, paddingBottom: space.xxl },
  empty: { padding: space.xxl, textAlign: 'center' },
});
