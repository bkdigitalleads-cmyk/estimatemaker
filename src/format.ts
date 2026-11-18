/**
 * Money, numbers and dates in the phone's own format (expo-localization
 * gives the locale; Intl does the rest). Pure, checked by `npm test`.
 */
import { dayMs } from './dates.ts';

const nf = new Map<string, Intl.NumberFormat>();

function moneyFormat(currency: string, locale: string): Intl.NumberFormat {
  const key = `${locale}|${currency}`;
  let f = nf.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, { style: 'currency', currency });
    } catch {
      f = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    }
    nf.set(key, f);
  }
  return f;
}

/** Minor units as money: 125050 USD in en-US is "$1,250.50"; in de-DE, "1.250,50 $". */
export function formatMoney(minor: number, currency: string, locale: string): string {
  return moneyFormat(currency, locale).format((Number.isFinite(minor) ? minor : 0) / 100);
}

/** The digits a currency shows (2 for USD, 0 for JPY). */
export function currencyDigits(currency: string, locale = 'en-US'): number {
  return moneyFormat(currency, locale).resolvedOptions().maximumFractionDigits ?? 2;
}

/** Minor units as a plain number for an input field ("1250.50" or "1250,50"), no symbol or grouping. */
export function moneyInput(minor: number, currency: string, locale: string): string {
  const digits = currencyDigits(currency, locale);
  if (!minor) return '';
  return (minor / 100).toFixed(digits).replace('.', decimalMark(locale));
}

/** The locale's decimal mark, "." or ",". */
export function decimalMark(locale: string): string {
  try {
    const part = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal');
    return part?.value === ',' ? ',' : '.';
  } catch {
    return '.';
  }
}

/** A quantity or percent: up to 3 decimals, no trailing zeros, the locale's mark ("1.5", "1,5", "12"). */
export function formatNumber(n: number, locale: string, maxDigits = 3): string {
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: maxDigits, useGrouping: false }).format(Number.isFinite(n) ? n : 0);
  } catch {
    return String(n);
  }
}

/** "Nov 17, 2026" in en-US, "17 Nov 2026" in en-GB. */
export function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(dayMs(iso)));
  } catch {
    return iso;
  }
}

/** "November" for the home screen's month. */
export function monthName(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(dayMs(iso)));
  } catch {
    return iso.slice(0, 7);
  }
}

/** The currencies in the picker: code and a plain English name. The phone's own currency is added if missing. */
export const CURRENCIES: { code: string; name: string }[] = [
  { code: 'USD', name: 'US dollar' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British pound' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'NZD', name: 'New Zealand dollar' },
  { code: 'CHF', name: 'Swiss franc' },
  { code: 'SEK', name: 'Swedish krona' },
  { code: 'NOK', name: 'Norwegian krone' },
  { code: 'DKK', name: 'Danish krone' },
  { code: 'PLN', name: 'Polish zloty' },
  { code: 'CZK', name: 'Czech koruna' },
  { code: 'MXN', name: 'Mexican peso' },
  { code: 'BRL', name: 'Brazilian real' },
  { code: 'ARS', name: 'Argentine peso' },
  { code: 'CLP', name: 'Chilean peso' },
  { code: 'COP', name: 'Colombian peso' },
  { code: 'PEN', name: 'Peruvian sol' },
  { code: 'ZAR', name: 'South African rand' },
  { code: 'NGN', name: 'Nigerian naira' },
  { code: 'KES', name: 'Kenyan shilling' },
  { code: 'INR', name: 'Indian rupee' },
  { code: 'PKR', name: 'Pakistani rupee' },
  { code: 'PHP', name: 'Philippine peso' },
  { code: 'SGD', name: 'Singapore dollar' },
  { code: 'MYR', name: 'Malaysian ringgit' },
  { code: 'IDR', name: 'Indonesian rupiah' },
  { code: 'THB', name: 'Thai baht' },
  { code: 'JPY', name: 'Japanese yen' },
  { code: 'KRW', name: 'South Korean won' },
  { code: 'HKD', name: 'Hong Kong dollar' },
  { code: 'AED', name: 'UAE dirham' },
  { code: 'SAR', name: 'Saudi riyal' },
  { code: 'ILS', name: 'Israeli shekel' },
  { code: 'TRY', name: 'Turkish lira' },
];

export function currencyList(phoneCurrency: string | null | undefined): { code: string; name: string }[] {
  const c = (phoneCurrency ?? '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(c) || CURRENCIES.some((x) => x.code === c)) return CURRENCIES;
  return [{ code: c, name: c }, ...CURRENCIES];
}
