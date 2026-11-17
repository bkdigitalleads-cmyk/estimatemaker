/**
 * Getting a PDF out: the share sheet (Messages, Files, AirDrop and the
 * rest), Mail with the PDF attached, or Print. Files are made on the phone
 * and go only where the person sends them.
 */
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import * as Print from 'expo-print';
import { shareFile } from './store';

/** Opens the share sheet for a PDF already on disk. Resolves when the sheet closes. */
export async function sharePdf(uri: string, title: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this phone.');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
}

/** Writes the PDF under a readable name in the cache. */
export function writePdf(name: string, bytes: Uint8Array): string {
  return shareFile(name, bytes);
}

/** True when Mail has an account on this phone. */
export async function canMail(): Promise<boolean> {
  try {
    return await MailComposer.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Opens Mail with the PDF attached. Resolves with what the person did. */
export async function mailPdf(uri: string, opts: { to?: string; subject: string; body: string }): Promise<'sent' | 'saved' | 'cancelled' | 'unknown'> {
  const res = await MailComposer.composeAsync({
    recipients: opts.to ? [opts.to] : [],
    subject: opts.subject,
    body: opts.body,
    attachments: [uri],
  });
  return res.status === 'sent' || res.status === 'saved' || res.status === 'cancelled' ? res.status : 'unknown';
}

/** The system print sheet for the PDF. */
export async function printPdf(uri: string): Promise<void> {
  await Print.printAsync({ uri });
}

/** "Invoice INV-0007 Dana Ruiz.pdf": readable, safe on every file system. */
export function pdfFileName(parts: string[]): string {
  const clean = parts
    .join(' ')
    .replace(/[\\/:*?"<>|,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${clean || 'Document'}.pdf`;
}
