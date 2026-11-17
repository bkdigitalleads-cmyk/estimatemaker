/**
 * Form pieces for the editors, built on the kit: labelled input rows,
 * money and number fields in the phone's own format, switches, a choice
 * row, the status stamp and a month calendar in a drawer.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, TextInputProps, View } from 'react-native';
import { Theme, radius, space, tabular, type } from '../theme';
import { decimalMark, formatNumber, moneyInput } from '../format';
import { parseAmount, parseNumber } from '../money';
import { addDays, dayMs, isoDay } from '../dates';
import type { Status } from '../model';
import { STATUS_LABEL } from '../model';
import Glyph from './Glyph';
import { Drawer, GlyphButton, Label, Panel, Tap } from './Kit';
import { tick } from './motion';

export function Section({ theme, label, children, style }: { theme: Theme; label?: string; children: React.ReactNode; style?: any }) {
  return (
    <View style={style}>
      {label ? <Label theme={theme}>{label}</Label> : null}
      <Panel theme={theme}>{children}</Panel>
    </View>
  );
}

const rule = (theme: Theme, first?: boolean) => (first ? null : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.rule });

/** A label on the left and a text input filling the rest. Multiline rows put the label above. */
export function InputRow({ theme, label, first, multiline, style, ...rest }: TextInputProps & { theme: Theme; label: string; first?: boolean }) {
  if (multiline) {
    return (
      <View style={[styles.stack, rule(theme, first)]}>
        <Text style={[type.small, { color: theme.inkSoft }]}>{label}</Text>
        <TextInput
          multiline
          placeholderTextColor={theme.inkFaint}
          selectionColor={theme.accent}
          accessibilityLabel={label}
          {...rest}
          style={[type.body, styles.multi, { color: theme.ink }, style]}
        />
      </View>
    );
  }
  return (
    <View style={[styles.inputRow, rule(theme, first)]}>
      <Text style={[type.body, styles.inputLabel, { color: theme.inkSoft }]} numberOfLines={1}>
        {label}
      </Text>
      <TextInput placeholderTextColor={theme.inkFaint} selectionColor={theme.accent} accessibilityLabel={label} {...rest} style={[type.body, styles.input, { color: theme.ink }, style]} />
    </View>
  );
}

/** Money typed in the phone's format; calls onValue with minor units (0 when empty). */
export function MoneyRow({ theme, label, value, onValue, currency, locale, first, placeholder }: { theme: Theme; label: string; value: number; onValue: (minor: number) => void; currency: string; locale: string; first?: boolean; placeholder?: string }) {
  const mark = useMemo(() => decimalMark(locale), [locale]);
  const [text, setText] = useState(() => moneyInput(value, currency, locale));
  // A new value from outside (another line picked) replaces the text; typing does not fight it.
  useEffect(() => {
    if ((parseAmount(text, mark) ?? 0) !== value) setText(moneyInput(value, currency, locale));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, currency, locale]);
  return (
    <InputRow
      theme={theme}
      label={label}
      first={first}
      value={text}
      placeholder={placeholder ?? `0${mark}00`}
      keyboardType="decimal-pad"
      onChangeText={(t) => {
        setText(t);
        onValue(parseAmount(t, mark) ?? 0);
      }}
      style={[styles.right, tabular]}
    />
  );
}

/** A quantity or a percent, in the phone's format. */
export function NumberRow({ theme, label, value, onValue, locale, first, suffix, allowEmpty = false }: { theme: Theme; label: string; value: number; onValue: (n: number) => void; locale: string; first?: boolean; suffix?: string; allowEmpty?: boolean }) {
  const mark = useMemo(() => decimalMark(locale), [locale]);
  const [text, setText] = useState(() => (allowEmpty && !value ? '' : formatNumber(value, locale)));
  useEffect(() => {
    if ((parseNumber(text, mark) ?? 0) !== value) setText(allowEmpty && !value ? '' : formatNumber(value, locale));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, locale]);
  return (
    <View style={[styles.inputRow, rule(theme, first)]}>
      <Text style={[type.body, styles.inputLabel, { color: theme.inkSoft }]} numberOfLines={1}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholder="0"
        placeholderTextColor={theme.inkFaint}
        selectionColor={theme.accent}
        keyboardType="decimal-pad"
        value={text}
        onChangeText={(t) => {
          setText(t);
          onValue(parseNumber(t, mark) ?? 0);
        }}
        style={[type.body, styles.input, styles.right, tabular, { color: theme.ink }]}
      />
      {suffix ? <Text style={[type.body, { color: theme.inkSoft }]}>{suffix}</Text> : null}
    </View>
  );
}

export function SwitchRow({ theme, label, sub, value, onValue, first }: { theme: Theme; label: string; sub?: string; value: boolean; onValue: (v: boolean) => void; first?: boolean }) {
  return (
    <View style={[styles.inputRow, rule(theme, first)]}>
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: theme.ink }]}>{label}</Text>
        {sub ? <Text style={[type.small, { color: theme.inkSoft }]}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValue} accessibilityLabel={label} trackColor={{ true: theme.ink, false: theme.raised }} thumbColor={theme.isDark ? theme.bg : '#FFFFFF'} />
    </View>
  );
}

/** A row of choices; the picked one is a darker well with an ink edge. */
export function Choice<T extends string | number>({ theme, options, value, onChange, label }: { theme: Theme; options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <View style={styles.choice} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Tap
            key={String(o.id)}
            onPress={() => {
              tick();
              onChange(o.id);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            style={[styles.choiceItem, { backgroundColor: on ? theme.picked : 'transparent', borderColor: on ? theme.pickedEdge : theme.inkFaint }]}
            pressedStyle={{ backgroundColor: theme.raised }}
          >
            <Text style={[type.small, { color: on ? theme.bg : theme.ink, fontWeight: '600' }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
              {o.label}
            </Text>
          </Tap>
        );
      })}
    </View>
  );
}

/** The status, like a rubber stamp on the corner of a ticket. */
export function Stamp({ theme, status, overdue = false }: { theme: Theme; status: Status; overdue?: boolean }) {
  const color = overdue ? theme.danger : status === 'paid' || status === 'accepted' ? theme.good : status === 'sent' ? theme.ink : theme.inkFaint;
  return (
    <View style={[styles.stamp, { borderColor: color }]} accessible accessibilityLabel={overdue ? 'Overdue' : STATUS_LABEL[status]}>
      <Text style={[styles.stampText, { color }]} maxFontSizeMultiplier={1.2}>
        {overdue ? 'OVERDUE' : STATUS_LABEL[status].toUpperCase()}
      </Text>
    </View>
  );
}

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** A month calendar in a drawer, with quick picks. */
export function DateSheet({
  theme,
  visible,
  title,
  value,
  onPick,
  onClose,
  locale,
  quick,
}: {
  theme: Theme;
  visible: boolean;
  title: string;
  value: string;
  onPick: (iso: string) => void;
  onClose: () => void;
  locale: string;
  quick?: { label: string; iso: string }[];
}) {
  const [month, setMonth] = useState(() => value.slice(0, 7));
  useEffect(() => {
    if (visible) setMonth(value.slice(0, 7));
  }, [visible, value]);
  const first = `${month}-01`;
  const startDow = new Date(dayMs(first)).getDay();
  const days: (string | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = first; d.slice(0, 7) === month; d = addDays(d, 1)) days.push(d);
  while (days.length % 7) days.push(null);
  const today = isoDay(Date.now());
  let monthLabel = month;
  try {
    monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(dayMs(first)));
  } catch {
    // keep "2026-11"
  }
  const shift = (n: number) => {
    const d = new Date(dayMs(first));
    d.setMonth(d.getMonth() + n);
    setMonth(isoDay(d.getTime()).slice(0, 7));
  };
  return (
    <Drawer theme={theme} visible={visible} onClose={onClose} title={title}>
      {quick?.length ? (
        <View style={[styles.choice, { marginBottom: space.m }]}>
          {quick.map((q) => (
            <Tap key={q.label} onPress={() => onPick(q.iso)} style={[styles.choiceItem, { backgroundColor: q.iso === value ? theme.picked : 'transparent', borderColor: q.iso === value ? theme.pickedEdge : theme.inkFaint }]} accessibilityRole="button" accessibilityLabel={q.label}>
              <Text style={[type.small, { color: q.iso === value ? theme.bg : theme.ink, fontWeight: '600' }]}>{q.label}</Text>
            </Tap>
          ))}
        </View>
      ) : null}
      <View style={styles.monthHead}>
        <GlyphButton theme={theme} glyph="back" label="Previous month" onPress={() => shift(-1)} />
        <Text style={[type.strong, { color: theme.ink, flex: 1, textAlign: 'center' }]}>{monthLabel}</Text>
        <GlyphButton theme={theme} glyph="chevron" label="Next month" onPress={() => shift(1)} />
      </View>
      <View style={styles.grid}>
        {WEEK.map((w, i) => (
          <Text key={i} style={[type.small, styles.cell, { color: theme.inkFaint, textAlign: 'center' }]}>
            {w}
          </Text>
        ))}
        {days.map((d, i) =>
          d ? (
            <Tap
              key={d}
              onPress={() => onPick(d)}
              style={[styles.cell, styles.day, d === value && { backgroundColor: theme.ink }, d === today && d !== value && { borderColor: theme.inkFaint, borderWidth: 1 }]}
              accessibilityRole="button"
              accessibilityLabel={d}
              accessibilityState={{ selected: d === value }}
            >
              <Text style={[type.body, tabular, { color: d === value ? theme.bg : theme.ink }]}>{Number(d.slice(8))}</Text>
            </Tap>
          ) : (
            <View key={`e${i}`} style={styles.cell} />
          )
        )}
      </View>
    </Drawer>
  );
}

/** A tappable row that shows a value on the right (dates, the client, the template). */
export function ValueRow({ theme, label, value, onPress, first, placeholder, glyph }: { theme: Theme; label: string; value: string; onPress: () => void; first?: boolean; placeholder?: string; glyph?: React.ComponentProps<typeof Glyph>['name'] }) {
  return (
    <Tap onPress={onPress} style={[styles.inputRow, rule(theme, first)]} pressedStyle={{ backgroundColor: theme.raised }} accessibilityRole="button" accessibilityLabel={`${label}, ${value || placeholder || ''}`}>
      {glyph ? <Glyph name={glyph} size={20} color={theme.inkSoft} /> : null}
      <Text style={[type.body, styles.inputLabel, { color: theme.inkSoft }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[type.body, { flex: 1, textAlign: 'right', color: value ? theme.ink : theme.inkFaint }]} numberOfLines={1}>
        {value || placeholder}
      </Text>
      <Glyph name="chevron" size={16} color={theme.inkFaint} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 52, paddingHorizontal: space.l },
  inputLabel: { minWidth: 96, flexShrink: 0 },
  input: { flex: 1, minWidth: 0, minHeight: 52, paddingVertical: space.s },
  right: { textAlign: 'right' },
  stack: { paddingHorizontal: space.l, paddingTop: space.m, paddingBottom: space.s },
  multi: { minHeight: 72, paddingTop: space.xs, textAlignVertical: 'top' },
  choice: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  choiceItem: { minHeight: 40, borderRadius: radius.small, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.m },
  stamp: { borderWidth: 1.5, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, transform: [{ rotate: '-3deg' }] },
  stampText: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1 },
  monthHead: { flexDirection: 'row', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.s, marginBottom: space.l },
  cell: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' },
  day: { borderRadius: radius.round },
});
