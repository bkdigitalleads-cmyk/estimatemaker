/**
 * The business logo, made ready for the PDF with Skia, off screen: the
 * picked photo is decoded (Skia applies its orientation), brought down to
 * at most 900 px on the long side, and re-encoded as PNG so a logo with a
 * clear background stays clear on the page. pdf-lib embeds PNG and JPEG
 * only, and HEIC from Photos is neither, so this step is not optional.
 */
import { ImageFormat, Skia } from '@shopify/react-native-skia';

export const LOGO_MAX = 900;

export async function normalizeLogo(uri: string): Promise<{ base64: string; width: number; height: number } | null> {
  const data = await Skia.Data.fromURI(uri);
  const img = Skia.Image.MakeImageFromEncoded(data);
  if (!img) return null;
  const k = Math.min(1, LOGO_MAX / Math.max(img.width(), img.height()));
  const w = Math.max(1, Math.round(img.width() * k));
  const h = Math.max(1, Math.round(img.height() * k));
  const surface = Skia.Surface.Make(w, h);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('transparent'));
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  canvas.drawImageRect(img, Skia.XYWHRect(0, 0, img.width(), img.height()), Skia.XYWHRect(0, 0, w, h), paint);
  surface.flush();
  return { base64: surface.makeImageSnapshot().encodeToBase64(ImageFormat.PNG, 100), width: w, height: h };
}
