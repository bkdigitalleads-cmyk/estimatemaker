import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** The torn bottom edge of a ticket: small teeth in the ticket's own color. */
export function TornEdge({ width, color, tooth = 12, height = 7 }: { width: number; color: string; tooth?: number; height?: number }) {
  const n = Math.max(1, Math.round(width / tooth));
  const w = width / n;
  let d = `M0 0 H${width} `;
  for (let i = 0; i < n; i++) d += `L${width - w * i - w / 2} ${height} L${width - w * (i + 1)} 0 `;
  return (
    <View pointerEvents="none" style={{ width, height }} accessible={false}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={`${d}Z`} fill={color} stroke="none" strokeWidth={0} strokeLinecap="butt" strokeLinejoin="miter" />
      </Svg>
    </View>
  );
}

/** A perforation down the middle of a ticket: a dashed line. */
export function Perforation({ height, color }: { height: number; color: string }) {
  const dashes = Math.floor(height / 7);
  return (
    <View pointerEvents="none" style={{ width: 1, height, justifyContent: 'space-between' }} accessible={false}>
      {Array.from({ length: dashes }, (_, i) => (
        <View key={i} style={{ width: 1, height: 3, backgroundColor: color }} />
      ))}
    </View>
  );
}
