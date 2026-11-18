import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Canvas, Group, Image as SkiaImage, Line, Path, Rect, Skia, SkTypeface, Text as SkiaText, vec } from '@shopify/react-native-skia';
import type { FontKey, Page } from '../pdf/layout';

/**
 * One page of a document, drawn by Skia from the same operations the PDF
 * writer draws, with the same font files, so the preview is the PDF.
 */
export default function PageView({ page, width, faces, logoBase64, label }: { page: Page; width: number; faces: Record<FontKey, SkTypeface>; logoBase64: string | null; label: string }) {
  const k = width / page.width;
  const height = page.height * k;
  const logo = useMemo(() => (logoBase64 ? Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(logoBase64)) : null), [logoBase64]);
  const fonts = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof Skia.Font>>();
    return (key: FontKey, size: number) => {
      const id = `${key}|${size}`;
      let f = cache.get(id);
      if (!f) {
        f = Skia.Font(faces[key], size);
        cache.set(id, f);
      }
      return f;
    };
  }, [faces]);

  return (
    <View style={{ width, height, backgroundColor: '#FFFFFF' }} accessible accessibilityRole="image" accessibilityLabel={label}>
      <Canvas style={{ width, height }}>
        <Group transform={[{ scale: k }]}>
          {page.ops.map((op, i) => {
            if (op.k === 'text') {
              const t = <SkiaText key={i} x={op.x} y={op.y} text={op.text} font={fonts(op.font, op.size)} color={op.color} />;
              return op.rotate ? (
                <Group key={i} origin={vec(op.x, op.y)} transform={[{ rotate: (op.rotate * Math.PI) / 180 }]}>
                  {t}
                </Group>
              ) : (
                t
              );
            }
            if (op.k === 'rect') {
              const r = (
                <Group key={i}>
                  {op.fill ? <Rect x={op.x} y={op.y} width={op.w} height={op.h} color={op.fill} /> : null}
                  {op.stroke ? <Rect x={op.x} y={op.y} width={op.w} height={op.h} color={op.stroke} style="stroke" strokeWidth={op.lw ?? 1} /> : null}
                </Group>
              );
              return op.rotate ? (
                <Group key={i} origin={vec(op.x, op.y)} transform={[{ rotate: (op.rotate * Math.PI) / 180 }]}>
                  {r}
                </Group>
              ) : (
                r
              );
            }
            if (op.k === 'line') return <Line key={i} p1={vec(op.x1, op.y1)} p2={vec(op.x2, op.y2)} color={op.color} strokeWidth={op.lw} style="stroke" />;
            if (op.k === 'image') return logo ? <SkiaImage key={i} image={logo} x={op.x} y={op.y} width={op.w} height={op.h} fit="fill" /> : null;
            return (
              <Group key={i} transform={[{ translateX: op.tx }, { translateY: op.ty }, { scale: op.s }]}>
                <Path path={op.d} color={op.color} />
              </Group>
            );
          })}
        </Group>
      </Canvas>
    </View>
  );
}
