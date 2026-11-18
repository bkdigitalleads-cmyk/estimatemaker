/**
 * The PDF fonts' bytes from the app bundle (expo-asset), loaded once, and
 * everything built on them: the measurer, Skia typefaces for the preview,
 * and the finished PDF.
 */
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { Skia, SkTypeface } from '@shopify/react-native-skia';
import type { FontKey, LayoutInput, Measure, Page } from './pdf/layout';
import { layoutDoc } from './pdf/layout';
import { FontBytes, makeMeasure } from './pdf/fonts';
import { writePdf } from './pdf/pdf';
import { base64ToBytes } from './pdf/base64';
import type { Logo } from './settings';
import { TYPE_LABEL } from './model';

const MODULES: Record<FontKey, number> = {
  regular: require('../assets/fonts/IBMPlexSans-Regular.ttf'),
  bold: require('../assets/fonts/IBMPlexSans-SemiBold.ttf'),
  display: require('../assets/fonts/IBMPlexSansCondensed-SemiBold.ttf'),
  mono: require('../assets/fonts/IBMPlexMono-Regular.ttf'),
};

export interface PdfKit {
  bytes: FontBytes;
  measure: Measure;
  faces: Record<FontKey, SkTypeface>;
}

let loading: Promise<PdfKit> | null = null;

async function load(): Promise<PdfKit> {
  const bytes = {} as FontBytes;
  const faces = {} as Record<FontKey, SkTypeface>;
  for (const k of Object.keys(MODULES) as FontKey[]) {
    const asset = Asset.fromModule(MODULES[k]);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    bytes[k] = await new File(uri).bytes();
    const tf = Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(bytes[k]));
    if (!tf) throw new Error('A document font did not load.');
    faces[k] = tf;
  }
  return { bytes, measure: makeMeasure(bytes), faces };
}

/** Fonts for laying out, previewing and writing PDFs, loaded on first use. */
export function pdfKit(): Promise<PdfKit> {
  if (!loading) {
    loading = load().catch((e) => {
      loading = null;
      throw e;
    });
  }
  return loading;
}

export function pagesFor(kit: PdfKit, input: Omit<LayoutInput, 'logo'> & { logo: Logo | null }): Page[] {
  return layoutDoc(kit.measure, { ...input, logo: input.logo ? { width: input.logo.width, height: input.logo.height } : null });
}

export async function pdfBytes(kit: PdfKit, pages: Page[], logo: Logo | null, meta: { type: keyof typeof TYPE_LABEL; number: string; business: string; client: string }): Promise<Uint8Array> {
  return writePdf(pages, kit.bytes, logo ? base64ToBytes(logo.base64) : null, {
    title: `${TYPE_LABEL[meta.type]} ${meta.number}`,
    author: meta.business,
    subject: meta.client ? `${TYPE_LABEL[meta.type]} for ${meta.client}` : TYPE_LABEL[meta.type],
  });
}
