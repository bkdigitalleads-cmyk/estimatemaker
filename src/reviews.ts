import * as StoreReview from 'expo-store-review';
import { kvGet, kvSet } from './store';
import { ReviewTrigger, shouldAsk } from './rules';

export type { ReviewTrigger } from './rules';

/**
 * App Store rating asks, at moments the person just got something (the
 * triggers are listed in rules.ts): after the first PDF goes out and after
 * a free trial starts. Each fires at most once ever, at most one prompt per
 * launch, never while a client is signing on the screen, and StoreKit still
 * decides whether the prompt is shown (it caps it at 3 a year). The
 * decisions are pure functions in rules.ts, checked by `npm test`.
 * Same engine as Signature Maker, Migraine Log, Image to Text, Pumping and Odo 1.0.6.
 */
const triggerKey = (t: ReviewTrigger) => `review.${t}`;

let launchState: 'idle' | 'checking' | 'asked' = 'idle';
let signing: () => boolean = () => false;

/** state.tsx tells this module whether the Sign here pad is open. */
export function setReviewGuard(isSigning: () => boolean): void {
  signing = isSigning;
}

export async function maybeRequestReview(trigger: ReviewTrigger): Promise<void> {
  if (launchState !== 'idle' || signing()) return;
  launchState = 'checking';
  try {
    const used = (await kvGet(triggerKey(trigger))) != null;
    const storeCanAsk = await StoreReview.hasAction();
    if (!shouldAsk({ signing: signing(), askedThisLaunch: false, triggerUsed: used, storeCanAsk })) return;
    await kvSet(triggerKey(trigger), '1');
    launchState = 'asked';
    setTimeout(() => {
      // One last look: a signing pad opened in the meantime wins.
      if (!signing()) StoreReview.requestReview().catch(() => {});
    }, 1200);
  } catch {
    // never let review plumbing get in the way
  } finally {
    if (launchState === 'checking') launchState = 'idle';
  }
}
