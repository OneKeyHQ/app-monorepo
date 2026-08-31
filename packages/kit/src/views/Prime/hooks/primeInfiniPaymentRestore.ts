/* cspell:ignore Infini */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  isPrimeInfiniPaymentCacheKeyForContext,
  isPrimeInfiniPurchaseCompletedSnapshot,
  isSamePrimeInfiniPaymentAssetIdentity,
  isSamePrimeInfiniPaymentTransferSnapshot,
  mergePrimeInfiniPaymentProgressSnapshot,
} from '@onekeyhq/shared/src/utils/primeInfiniPaymentCacheUtils';
import type {
  IPrimeInfiniPayment,
  IPrimeInfiniPaymentAsset,
  IPrimeInfiniPaymentCacheKey,
  IPrimeInfiniPendingPaymentSession,
  IPrimeInfiniPurchaseStatusSnapshot,
  IPrimeInfiniSubscriptionPlan,
} from '@onekeyhq/shared/types/prime/primeTypes';

import {
  hasPrimeInfiniPaymentProgress,
  isPrimeInfiniPaymentForAsset,
  isPrimeInfiniPaymentReplaceable,
} from './primeInfiniPaymentUtils';

export type IPrimeInfiniPaymentRestoreResult =
  | {
      type: 'restore';
      session: IPrimeInfiniPendingPaymentSession;
      asset: IPrimeInfiniPaymentAsset;
    }
  | {
      type: 'discarded';
    }
  | {
      type: 'completed';
    };

function isSamePaymentAssetMetadata(
  first: IPrimeInfiniPaymentAsset,
  second: IPrimeInfiniPaymentAsset,
) {
  return (
    first.chain === second.chain &&
    first.token === second.token &&
    isSamePrimeInfiniPaymentAssetIdentity(first, second)
  );
}

export async function resolvePrimeInfiniPaymentRestore({
  session,
  supportedAssets,
  paymentOptionsLoaded,
  createNewPayment,
  flowId,
  requestedPlan,
  requestedSubscriptionPeriod,
  fetchLatestPayment,
  fetchPurchaseStatusSnapshot,
  discardPaymentSession,
  clearCompletedPaymentSession,
  persistRestoredSession,
}: {
  session: IPrimeInfiniPendingPaymentSession;
  supportedAssets: IPrimeInfiniPaymentAsset[];
  paymentOptionsLoaded: boolean;
  createNewPayment: boolean;
  flowId?: string;
  requestedPlan: IPrimeInfiniSubscriptionPlan;
  requestedSubscriptionPeriod: 'P1M' | 'P1Y';
  fetchLatestPayment: (paymentId: string) => Promise<IPrimeInfiniPayment>;
  fetchPurchaseStatusSnapshot: () => Promise<IPrimeInfiniPurchaseStatusSnapshot>;
  discardPaymentSession: (
    paymentCacheKey: IPrimeInfiniPaymentCacheKey,
  ) => Promise<boolean>;
  clearCompletedPaymentSession: (
    paymentCacheKey: IPrimeInfiniPaymentCacheKey,
  ) => Promise<void>;
  persistRestoredSession: (
    session: IPrimeInfiniPendingPaymentSession,
  ) => Promise<IPrimeInfiniPendingPaymentSession>;
}): Promise<IPrimeInfiniPaymentRestoreResult> {
  if (
    !isPrimeInfiniPaymentCacheKeyForContext({
      cacheKey: session.paymentCacheKey,
      payment: session.payment,
      asset: session.asset,
      onekeyUserId: session.baseline.onekeyUserId,
      plan: session.plan,
      payerAccountId: session.payerAccountId,
      payerAddress: session.payerAddress,
    })
  ) {
    throw new OneKeyLocalError('Invalid Infini payment cache identity');
  }

  const latestPayment = await fetchLatestPayment(
    session.paymentCacheKey.paymentId,
  );
  const purchaseStatusSnapshot = await fetchPurchaseStatusSnapshot();
  if (purchaseStatusSnapshot.onekeyUserId !== session.baseline.onekeyUserId) {
    throw new OneKeyLocalError(
      'Infini purchase status user changed during restore',
    );
  }
  if (
    isPrimeInfiniPurchaseCompletedSnapshot({
      baseline: session.baseline,
      purchaseStatusSnapshot,
    })
  ) {
    await clearCompletedPaymentSession(session.paymentCacheKey);
    return { type: 'completed' };
  }
  const transferSnapshotUnchanged = isSamePrimeInfiniPaymentTransferSnapshot({
    first: session.payment,
    second: latestPayment,
    networkId: session.asset.networkId,
  });
  const paymentMatchesAsset = isPrimeInfiniPaymentForAsset({
    payment: latestPayment,
    asset: session.asset,
  });
  const paymentWithDurableProgress = mergePrimeInfiniPaymentProgressSnapshot({
    previous: session.payment,
    latest: latestPayment,
  });
  const supportedAsset = supportedAssets.find((asset) =>
    isSamePaymentAssetMetadata(asset, session.asset),
  );
  const routeMatches =
    session.plan === requestedPlan &&
    session.selectedSubscriptionPeriod === requestedSubscriptionPeriod;
  const hasPaymentProgress = hasPrimeInfiniPaymentProgress(
    paymentWithDurableProgress,
  );
  const shouldTrackPayment =
    session.sendStarted ||
    hasPrimeInfiniPaymentProgress(session.payment) ||
    hasPaymentProgress;
  if (!paymentOptionsLoaded && !shouldTrackPayment) {
    throw new OneKeyLocalError(
      'Infini payment options are unavailable during restore',
    );
  }
  const assetIsStillSupported =
    !paymentOptionsLoaded || Boolean(supportedAsset);
  const shouldReplacePayment =
    (createNewPayment && (!flowId || session.flowId !== flowId)) ||
    !transferSnapshotUnchanged ||
    !paymentMatchesAsset ||
    !routeMatches ||
    !assetIsStillSupported;
  if (
    shouldReplacePayment &&
    isPrimeInfiniPaymentReplaceable({
      payment: paymentWithDurableProgress,
      sendStarted: shouldTrackPayment,
    })
  ) {
    if (await discardPaymentSession(session.paymentCacheKey)) {
      return { type: 'discarded' };
    }
    throw new OneKeyLocalError('Infini payment session changed during restore');
  }
  if (!transferSnapshotUnchanged || !paymentMatchesAsset) {
    throw new OneKeyLocalError(
      'Infini payment transfer snapshot changed during restore',
    );
  }

  if ((!routeMatches || !assetIsStillSupported) && !shouldTrackPayment) {
    throw new OneKeyLocalError('Infini payment context changed during restore');
  }

  const nextSession = {
    ...session,
    asset: supportedAsset ?? session.asset,
    payment: paymentWithDurableProgress,
    sendStarted: shouldTrackPayment,
  };
  // Writing on every restore refreshed updatedAt, and because sendStarted only
  // ever latches on, a session that blocks the purchase entry had its age reset
  // each time the user opened this page. The age limit meant to eventually
  // release it therefore never arrived, and the more the user retried the
  // longer it survived. Only write when the restore actually learned something.
  const hasSessionChanged =
    nextSession.asset.key !== session.asset.key ||
    nextSession.sendStarted !== session.sendStarted ||
    nextSession.payment.amountConfirmed !== session.payment.amountConfirmed ||
    nextSession.payment.amountConfirming !== session.payment.amountConfirming ||
    nextSession.payment.status !== session.payment.status ||
    nextSession.payment.infiniStatus !== session.payment.infiniStatus ||
    nextSession.payment.expiresAt !== session.payment.expiresAt;
  const persistedSession = hasSessionChanged
    ? await persistRestoredSession(nextSession)
    : nextSession;
  return {
    type: 'restore',
    asset: persistedSession.asset,
    session: persistedSession,
  };
}
