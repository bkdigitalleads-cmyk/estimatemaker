import { useColorScheme } from 'react-native';

/**
 * "The job ticket." A tradesperson's paperwork: a manila clipboard, work
 * tickets on it, ruled like a ledger, figures stamped by a numbering
 * machine, rubber stamps for the status. Light by default: manila behind,
 * paper in front, near-black ink. One accent, tape-measure orange, used
 * only for the primary action on a screen (New document, Preview and
 * send, Share PDF, Continue). The dark theme follows the system: the
 * clipboard goes to night-shift charcoal, the ticket to carbon, and the
 * documents themselves stay paper white.
 */
export interface Theme {
  /** The clipboard: the screen background. */
  bg: string;
  /** The ticket: lists, forms, the totals stub. */
  paper: string;
  /** Inputs and quiet buttons on the clipboard. */
  surface: string;
  /** One step up: wells, unselected pills, pressed rows. */
  raised: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  /** Hairlines between rows. */
  rule: string;
  /** The 1 px edge around cards and the sheet. */
  edge: string;
  /** The signing line on the pad; the ledger's margin rule. */
  baseline: string;
  /** The primary action. Nothing else uses it. */
  accent: string;
  onAccent: string;
  /** A selected pill: a darker well with an ink outline, not the accent. */
  picked: string;
  pickedEdge: string;
  danger: string;
  /** Paid and accepted stamps. */
  good: string;
  /** The signing pad and the document pages: white paper in both themes. */
  sheet: string;
  /** The ledger's margin line. */
  margin: string;
  scrim: string;
  isDark: boolean;
}

export const lightTheme: Theme = {
  bg: '#EEE8DC',
  paper: '#FCFAF5',
  surface: '#F7F3EA',
  raised: '#E3DCCD',
  ink: '#1C1B19',
  inkSoft: '#5B574F',
  inkFaint: '#8E887C',
  rule: '#DED7C8',
  edge: 'rgba(28, 27, 25, 0.12)',
  baseline: '#C9C0AE',
  accent: '#C9480B',
  onAccent: '#FFFFFF',
  picked: '#1C1B19',
  pickedEdge: '#1C1B19',
  danger: '#B3261E',
  good: '#2F6B4A',
  sheet: '#FFFFFF',
  margin: 'rgba(201, 72, 11, 0.35)',
  scrim: 'rgba(28, 24, 18, 0.4)',
  isDark: false,
};

export const darkTheme: Theme = {
  bg: '#141311',
  paper: '#1F1D1A',
  surface: '#1A1916',
  raised: '#2C2925',
  ink: '#EEE9DF',
  inkSoft: '#ABA59A',
  inkFaint: '#7C776D',
  rule: '#34312C',
  edge: 'rgba(255, 255, 255, 0.09)',
  baseline: '#C9C0AE',
  accent: '#F07A3A',
  onAccent: '#1A0E06',
  picked: '#EEE9DF',
  pickedEdge: '#EEE9DF',
  danger: '#F2867C',
  good: '#86C9A0',
  sheet: '#FFFFFF',
  margin: 'rgba(240, 122, 58, 0.35)',
  scrim: 'rgba(0, 0, 0, 0.55)',
  isDark: true,
};

/** Follows the system: light unless the phone is in dark mode. */
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

/**
 * Two corners, both small, like cut paper and a tag:
 *  - large (6): sheets, drawers and the main button
 *  - small (4): inputs, choices, quiet buttons
 * (round is only for circles: glyph buttons, radio dots, color dots.)
 */
export const radius = { large: 6, small: 4, round: 999 };

/** The spacing scale. Every margin, padding and gap is one of these. */
export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };

/**
 * IBM Plex (SIL OFL, assets/fonts/OFL-IBMPlex.txt), the same family the
 * PDFs are set in:
 *  - Plex Sans Condensed SemiBold for titles, field labels and the main
 *    button, like the lettering on a work ticket
 *  - Plex Mono for money and document numbers, like a numbering machine
 * Everything else is the system font, which reads best small and follows
 * Dynamic Type.
 */
export const fonts = {
  display: 'EM-Condensed',
  mono: 'EM-Mono',
};

/**
 * One type scale:
 *  - title 30: screen titles and onboarding lines (condensed)
 *  - body 17: rows, fields, body text (system; strong in semibold)
 *  - small 13: secondary lines
 *  - label 12: field labels and section heads, condensed capitals
 *  - figure 28: the big amounts (mono)
 */
export const type = {
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34 },
  body: { fontSize: 17, lineHeight: 23 },
  strong: { fontSize: 17, lineHeight: 23, fontWeight: '600' as const },
  small: { fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.display, fontSize: 13, lineHeight: 16, letterSpacing: 1.1, textTransform: 'uppercase' as const },
  figure: { fontFamily: fonts.mono, fontSize: 26, lineHeight: 32 },
  button: { fontFamily: fonts.display, fontSize: 19, lineHeight: 22, letterSpacing: 0.6, textTransform: 'uppercase' as const },
};

/** Money and numbers: Plex Mono, so columns of figures line up. */
export const tabular = { fontFamily: fonts.mono, fontVariant: ['tabular-nums' as const] };

/** The main buttons are at least this tall. */
export const MAIN_BUTTON = 60;

/** UI font files for useFonts in App.tsx. */
export const UI_FONT_FILES = {
  [fonts.display]: require('../assets/fonts/IBMPlexSansCondensed-SemiBold.ttf'),
  [fonts.mono]: require('../assets/fonts/IBMPlexMono-Medium.ttf'),
};
