import React, { useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme, space, tabular, type } from '../theme';
import { useData } from '../data';
import type { Item } from '../db/repo';
import { newId } from '../model';
import { formatMoney } from '../format';
import { Field, InkButton, QuietButton, Row, Title, TopBar } from '../ui/Kit';
import { InputRow, MoneyRow, Section, SwitchRow } from '../ui/Form';

/** The price list: work and parts you charge for again and again. */
export default function Items({ onEdit }: { onEdit: (it: Item | null) => void }) {
  const theme = useTheme();
  const { items, locale, defaults } = useData();
  const [q, setQ] = useState('');
  const shown = items.filter((it) => it.description.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <FlatList
      data={shown}
      keyExtractor={(it) => it.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: space.xxl }}
      ListHeaderComponent={
        <View style={styles.head}>
          <Title theme={theme}>Items</Title>
          <InkButton theme={theme} label="New item" glyph="plus" onPress={() => onEdit(null)} />
          {items.length > 4 ? <Field theme={theme} value={q} onChangeText={setQ} placeholder="Find an item" accessibilityLabel="Find an item" clearButtonMode="while-editing" /> : null}
        </View>
      }
      renderItem={({ item, index }) => (
        <View style={{ backgroundColor: theme.paper, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.rule }}>
        <Row
          theme={theme}
          first
          label={item.description || 'No description'}
          onPress={() => onEdit(item)}
          right={
            <Text style={[type.body, tabular, { color: theme.ink }]}>
              {formatMoney(item.rate, defaults.currency, locale.tag)}
              {item.unit ? <Text style={[type.small, { color: theme.inkSoft }]}> /{item.unit}</Text> : null}
            </Text>
          }
        />
        </View>
      )}
      ListEmptyComponent={<Text style={[type.body, styles.empty, { color: theme.inkSoft }]}>{items.length ? 'Nothing matches.' : 'Save your usual work and parts with their prices, and add them to any document in one tap.'}</Text>}
    />
  );
}

export function ItemEditor({ item, onBack }: { item: Item | null; onBack: () => void }) {
  const theme = useTheme();
  const data = useData();
  const now = Date.now();
  const [it, setIt] = useState<Item>(item ?? { id: newId(now), description: '', rate: 0, unit: '', taxable: true, createdAt: now, updatedAt: now });
  const save = async () => {
    if (!it.description.trim()) return Alert.alert('Add a description', 'As it should print on the document.');
    await data.saveItem({ ...it, updatedAt: Date.now() });
    onBack();
  };
  return (
    <View style={{ flex: 1 }}>
      <TopBar theme={theme} title={item ? 'Item' : 'New item'} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Section theme={theme}>
          <InputRow theme={theme} first multiline label="Description" value={it.description} onChangeText={(description) => setIt({ ...it, description })} placeholder="Service call, 1/2 in. copper pipe" autoFocus={!item} />
          <MoneyRow theme={theme} label="Price" value={it.rate} onValue={(rate) => setIt({ ...it, rate })} currency={data.defaults.currency} locale={data.locale.tag} />
          <InputRow theme={theme} label="Unit" value={it.unit} onChangeText={(unit) => setIt({ ...it, unit })} placeholder="hr, ea, ft" autoCapitalize="none" />
          <SwitchRow theme={theme} label="Taxable" value={it.taxable} onValue={(taxable) => setIt({ ...it, taxable })} />
        </Section>
        <InkButton theme={theme} label="Save item" onPress={save} />
        {item ? (
          <QuietButton
            theme={theme}
            tone="danger"
            glyph="trash"
            label="Delete item"
            onPress={() =>
              Alert.alert('Delete this item?', 'Documents that already use it keep their lines.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await data.removeItem(it.id);
                    onBack();
                  },
                },
              ])
            }
          />
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
