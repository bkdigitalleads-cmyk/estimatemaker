/**
 * Small behavior rules as pure functions checked by `npm test`: when a
 * rating prompt may ask, and the local day key.
 */

/**
 * When the app asks for an App Store rating (SKStoreReviewController, through
 * expo-store-review). Each is a moment the person just got something:
 *   trialStarted - a free trial started on the onboarding paywall
 *   firstExport  - the first PDF shared, mailed or printed
 */
export type ReviewTrigger = 'trialStarted' | 'firstExport';

/**
 * A rating prompt: never while a client is signing on the screen, at most
 * one per launch, each trigger once ever. (Engine rule; the engine's
 * "document open" is this app's "signing open".)
 */
export function reviewAllowed(opts: { signing: boolean; askedThisLaunch: boolean; triggerUsed: boolean }): boolean {
  return !opts.signing && !opts.askedThisLaunch && !opts.triggerUsed;
}

/** The whole decision for one ask: the guard above, and StoreKit able to show one at all. */
export function shouldAsk(opts: { signing: boolean; askedThisLaunch: boolean; triggerUsed: boolean; storeCanAsk: boolean }): boolean {
  return reviewAllowed(opts) && opts.storeCanAsk;
}

/** After a purchase: a trial that just started on the onboarding paywall asks for a rating. */
export function purchaseReview(opts: { onboarding: boolean; isPro: boolean; inTrial: boolean }): ReviewTrigger | null {
  return opts.onboarding && opts.isPro && opts.inTrial ? 'trialStarted' : null;
}

/**
 * When the onboarding paywall closes: with Pro, straight into the app; with
 * the X, the small "Your first two PDFs are free" sheet first.
 */
export function afterOnboardingPaywall(isPro: boolean): 'app' | 'claim' {
  return isPro ? 'app' : 'claim';
}

/** The local calendar day, "2026-11-17". */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
