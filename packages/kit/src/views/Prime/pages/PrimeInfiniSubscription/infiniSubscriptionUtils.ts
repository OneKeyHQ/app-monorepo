/* cspell:ignore Infini */
import type {
  IPrimeInfiniSubscription,
  IPrimeInfiniSubscriptionPlan,
} from '@onekeyhq/shared/types/prime/primeTypes';

const CANCELED_STATUSES = new Set(['canceled', 'cancelled']);

// The server plan enum is unconfirmed (integration plan §11-3): the yearly
// value may arrive as 'annual'. Normalize defensively so an unknown raw value
// never indexes the fixed price / lead-days maps into `undefined`; unknown
// values fall back to 'monthly', matching the existing non-'yearly' fallbacks.
export function normalizeInfiniSubscriptionPlan(
  plan: string | undefined,
): IPrimeInfiniSubscriptionPlan {
  const normalized = (plan ?? '').toLowerCase();
  if (
    normalized === 'yearly' ||
    normalized === 'annual' ||
    normalized === 'annually'
  ) {
    return 'yearly';
  }
  return 'monthly';
}

// A subscription is manageable in-app while its paid period has not ended,
// including canceled-but-not-expired ones (integration plan §5.3(d))
export function isInfiniSubscriptionInPeriod(
  subscription: IPrimeInfiniSubscription | undefined,
): boolean {
  if (!subscription) {
    return false;
  }
  if (subscription.currentPeriodEnd) {
    return subscription.currentPeriodEnd > Date.now();
  }
  // currentPeriodEnd is optional until the backend schema is finalized;
  // fall back to the status field
  return subscription.status.toLowerCase() === 'active';
}

// Whether renewal invoices have stopped: either explicitly canceled or the
// server reports willRenew=false. Infini has no auto-charge, so "renew" only
// means "keep generating renewal invoices" (integration plan §6)
export function isInfiniSubscriptionRenewalStopped(
  subscription: IPrimeInfiniSubscription,
): boolean {
  if (subscription.willRenew === false) {
    return true;
  }
  return CANCELED_STATUSES.has(subscription.status.toLowerCase());
}
