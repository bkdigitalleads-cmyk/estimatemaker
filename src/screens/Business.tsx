import React, { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, radius, space, type } from '../theme';
import { useData } from '../data';
import { normalizeLogo } from '../render';
import type { Business as B } from '../settings';
import { InkButton, QuietButton, TopBar } from '../ui/Kit';
import { InputRow, Section } from '../ui/Form';

/** Your business as it prints at the top of every document. */
export default function Business({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const data = useData();
  const [b, setB] = useState<B>(data.business);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<B>) => setB({ ...b, ...patch });

  const pickLogo = async () => {
    // The system photo picker: no Photos permission, and only the chosen picture reaches the app.
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    if (res.canceled || !res.assets?.[0]) return;
    setBusy(true);
    try {
      const logo = await normalizeLogo(res.assets[0].uri);
      if (!logo) throw new Error('That picture did not open. Try a PNG or JPEG.');
      await data.saveLogo(logo);
    } catch (e: any) {
      Alert.alert('The logo did not load', e?.message ?? 'Try another picture.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <TopBar theme={theme} title="Your business" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[type.body, { color: theme.inkSoft }]}>Printed at the top of every estimate, quote, invoice and receipt.</Text>
        <View style={styles.logoRow}>
          <View style={[styles.logoBox, { backgroundColor: theme.paper, borderColor: theme.edge }]}>
            {data.logo ? (
              <Image source={{ uri: `data:image/png;base64,${data.logo.base64}` }} style={styles.logo} resizeMode="contain" accessibilityLabel="Your logo" />
            ) : (
              <Text style={[type.small, { color: theme.paperInkSoft, textAlign: 'center' }]}>No logo</Text>
            )}
          </View>
          <View style={{ flex: 1, gap: space.s }}>
            <QuietButton theme={theme} glyph="photo" label={busy ? 'Loading' : data.logo ? 'Change logo' : 'Add logo'} onPress={pickLogo} disabled={busy} />
            {data.logo ? <QuietButton theme={theme} tone="danger" label="Remove" onPress={() => data.saveLogo(null)} /> : null}
          </View>
        </View>
        <Section theme={theme}>
          <InputRow theme={theme} first label="Name" value={b.name} onChangeText={(name) => set({ name })} placeholder="Your business name" autoCapitalize="words" />
          <InputRow theme={theme} multiline label="Address" value={b.address} onChangeText={(address) => set({ address })} placeholder="Street, city, postcode" />
          <InputRow theme={theme} label="Phone" value={b.phone} onChangeText={(phone) => set({ phone })} keyboardType="phone-pad" />
          <InputRow theme={theme} label="Email" value={b.email} onChangeText={(email) => set({ email })} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <InputRow theme={theme} label="Website" value={b.website} onChangeText={(website) => set({ website })} keyboardType="url" autoCapitalize="none" autoCorrect={false} />
          <InputRow theme={theme} label="Tax or license no." value={b.taxId} onChangeText={(taxId) => set({ taxId })} placeholder="Optional, prints as typed" />
        </Section>
        <InkButton
          theme={theme}
          label="Save"
          onPress={async () => {
            await data.saveBusiness({ ...b, name: b.name.trim() });
            onBack();
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.l, gap: space.xl, paddingBottom: space.xxl },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: space.l },
  logoBox: { width: 112, height: 112, borderRadius: radius.small, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: space.s },
  logo: { width: 96, height: 96 },
});
