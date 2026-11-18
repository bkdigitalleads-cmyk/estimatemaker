import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useTheme, radius, space, tabular, type, Theme } from '../theme';
import { useData } from '../data';
import { formatDate, formatMoney, monthName } from '../format';
import { DocRow, filterRows, Filter, isOverdue, NO_FILTER, summarize } from '../docs';
import { DOC_TYPES, DocType, STATUS_LABEL, STATUSES, TYPE_LABEL, TYPE_PLURAL } from '../model';
import { isoDay } from '../dates';
import Glyph from '../ui/Glyph';
import { Caption, Drawer, InkButton, Row, Tap, Title } from '../ui/Kit';
import { Choice, Stamp } from '../ui/Form';
import { Perforation, TornEdge } from '../ui/Paper';

/**
 * Home: the month's numbers, a new-document button, search, filters and
 * every document, newest first.
 */
export default function Documents({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: (type: DocType) => void }) {
  const theme = useTheme();
  const { rows, clients, locale, defaults, business } = useData();
  const [filter, setFilter] = useState<Filter>(NO_FILTER);
  const [picking, setPicking] = useState(false);
  const [filters, setFilters] = useState(false);
  const today = isoDay(Date.now());
  const shown = useMemo(() => filterRows(rows, filter), [rows, filter]);
  const sum = useMemo(() => summarize(rows, today), [rows, today]);
  const main = defaults.currency;
  const others = (o: Record<string, number>) =>
    Object.entries(o)
      .filter(([c, v]) => c !== main && v !== 0)
      .map(([c, v]) => formatMoney(v, c, locale.tag))
      .join(', ');
  const { width } = useWindowDimensions();
  const narrowed = filter.status != null || filter.clientId != null;
  const clientName = clients.find((c) => c.id === filter.clientId)?.name;

  const header = (
    <View style={styles.head}>
      <View style={styles.titleRow}>
        <Title theme={theme} style={{ flex: 1 }}>
          {business.name || 'Documents'}
        </Title>
      </View>
      <View>
        <View style={[styles.totals, { backgroundColor: theme.paper }]}>
          <Figure theme={theme} label={`Billed in ${monthName(today, locale.tag)}`} value={formatMoney(sum.month[main] ?? 0, main, locale.tag)} extra={others(sum.month)} />
          <Perforation height={64} color={theme.inkFaint} />
          <Figure
            theme={theme}
            label={sum.overdueCount > 0 ? `Unpaid, ${sum.overdueCount} overdue` : 'Unpaid'}
            value={formatMoney(sum.unpaid[main] ?? 0, main, locale.tag)}
            extra={others(sum.unpaid)}
            alert={sum.overdueCount > 0}
          />
        </View>
        <TornEdge width={width - space.l * 2} color={theme.paper} />
      </View>
      <InkButton theme={theme} label="New document" glyph="plus" onPress={() => setPicking(true)} />
      <View style={[styles.search, { backgroundColor: theme.paper, borderColor: theme.inkFaint }]}>
        <Glyph name="search" size={20} color={theme.inkFaint} />
        <TextInput
          value={filter.query}
          onChangeText={(query) => setFilter({ ...filter, query })}
          placeholder="Search by number, client or amount"
          placeholderTextColor={theme.inkFaint}
          selectionColor={theme.accent}
          style={[type.body, { flex: 1, color: theme.ink, minHeight: 44 }]}
          accessibilityLabel="Search documents"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        <Tap onPress={() => setFilters(true)} accessibilityRole="button" accessibilityLabel="Filter by status and client" style={styles.filterBtn}>
          <Glyph name="filter" size={22} color={narrowed ? theme.ink : theme.inkSoft} weight={narrowed ? 2.2 : 1.7} />
        </Tap>
      </View>
      <Choice<DocType | 'all'>
        theme={theme}
        label="Show"
        options={[{ id: 'all', label: 'All' }, ...DOC_TYPES.map((t) => ({ id: t, label: TYPE_PLURAL[t] }))]}
        value={filter.type ?? 'all'}
        onChange={(v) => setFilter({ ...filter, type: v === 'all' ? null : v })}
      />
      {narrowed ? (
        <Tap onPress={() => setFilter({ ...filter, status: null, clientId: null })} accessibilityRole="button" accessibilityLabel="Clear filters">
          <Caption theme={theme}>{[filter.status ? STATUS_LABEL[filter.status] : null, clientName].filter(Boolean).join(', ')}. Tap to clear.</Caption>
        </Tap>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={shown}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: space.xxl }}
        renderItem={({ item, index }) => <DocLine theme={theme} row={item} first={index === 0} today={today} locale={locale.tag} onPress={() => onOpen(item.id)} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[type.body, { color: theme.inkSoft, textAlign: 'center' }]}>
              {rows.length === 0 ? 'Nothing here yet. Start with an estimate; it turns into an invoice and a receipt with one tap.' : 'Nothing matches. Try another search or filter.'}
            </Text>
          </View>
        }
      />
      <Drawer theme={theme} visible={picking} onClose={() => setPicking(false)} title="New">
        {DOC_TYPES.map((t, i) => (
          <Row
            key={t}
            theme={theme}
            first={i === 0}
            label={TYPE_LABEL[t]}
            sub={t === 'estimate' ? 'A price for the job, before it starts' : t === 'quote' ? 'A fixed price you stand by' : t === 'invoice' ? 'A bill, with a due date' : 'Proof of payment'}
            onPress={() => {
              setPicking(false);
              onNew(t);
            }}
          />
        ))}
        <View style={{ height: space.l }} />
      </Drawer>
      <Drawer theme={theme} visible={filters} onClose={() => setFilters(false)} title="Filter">
        <Text style={[type.small, { color: theme.inkSoft, marginBottom: space.s }]}>Status</Text>
        <Choice
          theme={theme}
          options={[{ id: 'any', label: 'Any' }, ...STATUSES.map((s) => ({ id: s, label: STATUS_LABEL[s] }))]}
          value={filter.status ?? 'any'}
          onChange={(v) => setFilter({ ...filter, status: v === 'any' ? null : (v as any) })}
        />
        <Text style={[type.small, { color: theme.inkSoft, marginTop: space.l, marginBottom: space.s }]}>Client</Text>
        <Choice theme={theme} options={[{ id: 'any', label: 'Any' }, ...clients.map((c) => ({ id: c.id, label: c.name || 'No name' }))]} value={filter.clientId ?? 'any'} onChange={(v) => setFilter({ ...filter, clientId: v === 'any' ? null : v })} />
        <View style={{ height: space.xl }} />
        <InkButton theme={theme} label="Show results" onPress={() => setFilters(false)} />
      </Drawer>
    </View>
  );
}

function Figure({ theme, label, value, extra, alert = false }: { theme: Theme; label: string; value: string; extra?: string; alert?: boolean }) {
  return (
    <View style={styles.figure} accessible accessibilityLabel={`${label}: ${value}${extra ? `, and ${extra}` : ''}`}>
      <Text style={[type.label, { color: alert ? theme.danger : theme.inkSoft }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
      <Text style={[type.figure, { color: theme.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </Text>
      {extra ? (
        <Text style={[type.small, { color: theme.inkSoft }]} numberOfLines={1}>
          + {extra}
        </Text>
      ) : null}
    </View>
  );
}

/** One document as a line in the ledger: the type and date in the margin, the client and number, the amount and the stamp. */
export function DocLine({ theme, row, first, today, locale, onPress }: { theme: Theme; row: DocRow; first: boolean; today: string; locale: string; onPress: () => void }) {
  const overdue = isOverdue(row, today);
  const day = formatDate(row.issueDate, locale).replace(/,?\s*\d{4}$/, '');
  return (
    <Tap
      onPress={onPress}
      style={[styles.line, { backgroundColor: theme.paper, borderColor: theme.rule }, first && { borderTopWidth: StyleSheet.hairlineWidth }]}
      pressedStyle={{ backgroundColor: theme.raised }}
      accessibilityRole="button"
      accessibilityLabel={`${TYPE_LABEL[row.type]} ${row.number}, ${row.clientName || 'no client'}, ${formatMoney(row.total, row.currency, locale)}, ${overdue ? 'overdue' : STATUS_LABEL[row.status]}`}
    >
      <View style={styles.marginCol}>
        <Text style={[type.label, { color: theme.ink }]} maxFontSizeMultiplier={1.2}>
          {CODE[row.type]}
        </Text>
        <Text style={[type.small, { color: theme.inkSoft }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {day}
        </Text>
      </View>
      <View style={[styles.marginRule, { backgroundColor: theme.margin }]} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.body, { color: row.clientName ? theme.ink : theme.inkFaint }]} numberOfLines={1}>
          {row.clientName || 'No client yet'}
        </Text>
        <Text style={[type.small, tabular, { color: theme.inkSoft }]} numberOfLines={1}>
          {row.number}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: space.xs }}>
        <Text style={[type.body, tabular, { color: theme.ink }]}>{formatMoney(row.total, row.currency, locale)}</Text>
        <Stamp theme={theme} status={row.status} overdue={overdue} />
      </View>
    </Tap>
  );
}

const CODE: Record<DocType, string> = { estimate: 'Est', quote: 'Quote', invoice: 'Inv', receipt: 'Rec' };

const styles = StyleSheet.create({
  head: { padding: space.l, gap: space.l },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  totals: { flexDirection: 'row', alignItems: 'center', borderTopLeftRadius: radius.small, borderTopRightRadius: radius.small, paddingTop: space.l, paddingBottom: space.m },
  figure: { flex: 1, paddingHorizontal: space.l, gap: space.xs },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.s, borderWidth: 1.5, borderRadius: radius.small, paddingLeft: space.m },
  filterBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingRight: space.l, paddingVertical: space.m, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 68 },
  marginCol: { width: 64, paddingLeft: space.l, gap: 2 },
  marginRule: { position: 'absolute', left: 72, top: 0, bottom: 0, width: 1 },
  empty: { padding: space.xxl },
});
