import type { IPrimeWebCheckoutPendingSession } from '@onekeyhq/shared/types/prime/primeTypes';

// Allows for clock skew between this device and RevenueCat.
export const PRIME_WEB_CHECKOUT_PURCHASE_DATE_TOLERANCE_MS = 5 * 60 * 1000;

// The fields of a RevenueCat `Prime` entitlement used to attribute it.
export type IPrimeWebCheckoutEntitlement = {
  isActive: boolean;
  store: string;
  latestPurchaseDate: Date | null;
  isSandbox: boolean;
  periodType: string;
  productIdentifier: string;
};

export type IPrimeWebCheckoutResult =
  | { status: 'pending' }
  | { status: 'succeeded'; entitlement: IPrimeWebCheckoutEntitlement }
  // Prime became active, but not through this hosted checkout (another store,
  // an older Web Billing purchase, or the other sandbox mode).
  | { status: 'activatedElsewhere'; entitlement: IPrimeWebCheckoutEntitlement };

// Checkout opens only while Prime is inactive, so an active entitlement is
// attributed to this checkout only when every field points at it.
export function evaluatePrimeWebCheckoutResult({
  session,
  entitlement,
}: {
  session: Pick<IPrimeWebCheckoutPendingSession, 'isSandbox' | 'startedAt'>;
  entitlement: IPrimeWebCheckoutEntitlement | undefined;
}): IPrimeWebCheckoutResult {
  if (!entitlement?.isActive) {
    return { status: 'pending' };
  }
  const purchasedAt = entitlement.latestPurchaseDate?.getTime();
  const isFromThisCheckout =
    entitlement.store === 'rc_billing' &&
    entitlement.isSandbox === session.isSandbox &&
    typeof purchasedAt === 'number' &&
    Number.isFinite(purchasedAt) &&
    purchasedAt >=
      session.startedAt - PRIME_WEB_CHECKOUT_PURCHASE_DATE_TOLERANCE_MS;
  return isFromThisCheckout
    ? { status: 'succeeded', entitlement }
    : { status: 'activatedElsewhere', entitlement };
}
