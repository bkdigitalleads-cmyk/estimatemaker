/** The phone's locale, region and currency (expo-localization), read once at launch. */
import { getLocales } from 'expo-localization';

export interface PhoneLocale {
  /** "en-US", "de-DE". */
  tag: string;
  region: string | null;
  currency: string | null;
}

export function phoneLocale(): PhoneLocale {
  try {
    const l = getLocales()[0];
    return { tag: l?.languageTag || 'en-US', region: l?.regionCode ?? null, currency: l?.currencyCode ?? null };
  } catch {
    return { tag: 'en-US', region: 'US', currency: 'USD' };
  }
}
