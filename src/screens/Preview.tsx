import React from 'react';
import { View } from 'react-native';
import { useTheme, space } from '../theme';
import { Caption, TopBar } from '../ui/Kit';

/** The page as it will print, with Share, Mail and Print. (The PDF arrives in step 4.) */
export default function Preview({ id, onBack }: { id: string; onBack: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <TopBar theme={theme} title="Preview" onBack={onBack} />
      <Caption theme={theme} style={{ padding: space.l }}>
        {id}
      </Caption>
    </View>
  );
}
