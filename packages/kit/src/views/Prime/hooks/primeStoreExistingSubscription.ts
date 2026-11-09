import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IRevenueCatPurchaseResult } from '@onekeyhq/shared/types/prime/revenueCat';

// Covers clock skew and the StoreKit -> RevenueCat receipt round trip.
const EXISTING_TRANSACTION_TOLERANCE_MS = timerUtils.getTimeDurationMs({
  minute: 2,
});

function parseDateMs(value?: string) {
  const ms = value ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? ms : undefined;
}

/**
 * StoreKit 2 does not charge again when the Apple ID already holds an active
 * subscription in the group: `Product.purchase()` succeeds with the existing
 * transaction, and RevenueCat moves that entitlement to the current app user.
 * Such a result must be reported as a restore, not as a new payment.
 *
 * The existing transaction predates the purchase attempt on both the device
 * clock and RevenueCat's response clock. Requiring both keeps a fresh charge
 * from being misreported when only one clock is off. Missing data falls back
 * to the purchase path.
 */
export function isAppleExistingSubscriptionPurchaseResult({
  purchaseResult,
  purchaseStartedAtMs,
}: {
  purchaseResult: IRevenueCatPurchaseResult;
  purchaseStartedAtMs: number;
}): boolean {
  const transactionPurchasedAtMs = parseDateMs(
    purchaseResult.transaction?.purchaseDate,
  );
  const requestDateMs = parseDateMs(purchaseResult.customerInfo.requestDate);
  if (transactionPurchasedAtMs === undefined || requestDateMs === undefined) {
    return false;
  }
  return (
    Math.min(purchaseStartedAtMs, requestDateMs) - transactionPurchasedAtMs >
    EXISTING_TRANSACTION_TOLERANCE_MS
  );
}
