/* cspell:ignore Infini */
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  isPrimeInfiniPurchaseCompletedSnapshot,
  mergePrimeInfiniPaymentProgressSnapshot,
} from '@onekeyhq/shared/src/utils/primeInfiniPaymentCacheUtils';
import type {
  IPrimeInfiniPayment,
  IPrimeInfiniPendingPaymentSession,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { logPrimeInfiniPaymentFlow } from '../primeInfiniPaymentLogger';

import {
  hasPrimeInfiniPaymentProgress,
  isPrimeInfiniPaymentClosedUnpaid,
  isPrimeInfiniPaymentReplaceable,
} from './primeInfiniPaymentUtils';

async function getPrimeInfiniPendingPaymentContext(): Promise<{
  isLoggedIn: boolean;
  onekeyUserId: string | undefined;
  pendingPaymentSession: IPrimeInfiniPendingPaymentSession | undefined;
}> {
  const userInfo = await backgroundApiProxy.servicePrime.getLocalUserInfo();
  if (!userInfo.isLoggedIn || !userInfo.onekeyUserId) {
    return {
      isLoggedIn: false,
      onekeyUserId: undefined,
      pendingPaymentSession: undefined,
    };
  }
  const pendingPaymentSession: IPrimeInfiniPendingPaymentSession | undefined =
    await backgroundApiProxy.simpleDb.prime.getInfiniPendingPaymentSession({
      onekeyUserId: userInfo.onekeyUserId,
    });
  return {
    isLoggedIn: true,
    onekeyUserId: userInfo.onekeyUserId,
    pendingPaymentSession,
  };
}

async function clearCompletedPrimeInfiniPendingPaymentSession({
  pendingPaymentSession,
  onekeyUserId,
}: {
  pendingPaymentSession: IPrimeInfiniPendingPaymentSession;
  onekeyUserId: string;
}) {
  let purchaseStatusSnapshot:
    | Awaited<
        ReturnType<
          typeof backgroundApiProxy.servicePrime.apiGetInfiniPurchaseStatusSnapshot
        >
      >
    | undefined;
  try {
    purchaseStatusSnapshot =
      await backgroundApiProxy.servicePrime.apiGetInfiniPurchaseStatusSnapshot({
        expectedOneKeyUserId: onekeyUserId,
      });
  } catch (error) {
    logPrimeInfiniPaymentFlow({
      stage: 'paymentContext',
      status: 'failed',
      checkoutType: 'internalWallet',
      reason: 'entryGuardPurchaseStatusRefreshFailed',
      sendStarted: pendingPaymentSession.sendStarted,
      error,
    });
    return false;
  }
  if (purchaseStatusSnapshot.onekeyUserId !== onekeyUserId) {
    throw new OneKeyLocalError({
      message: 'Infini purchase status user changed while it was verified',
      autoToast: false,
    });
  }
  if (
    !isPrimeInfiniPurchaseCompletedSnapshot({
      baseline: pendingPaymentSession.baseline,
      purchaseStatusSnapshot,
    })
  ) {
    return false;
  }

  const didClear =
    await backgroundApiProxy.simpleDb.prime.clearInfiniPendingPaymentSession({
      onekeyUserId,
      expectedPaymentCacheIdentity: pendingPaymentSession.paymentCacheKey,
    });
  if (!didClear) {
    throw new OneKeyLocalError({
      message: 'Infini payment session changed while it was being verified',
      autoToast: false,
    });
  }
  return true;
}

export async function getPrimeInfiniExternalCheckoutGuard() {
  const context = await getPrimeInfiniPendingPaymentContext();
  if (
    context.pendingPaymentSession &&
    context.onekeyUserId &&
    (await clearCompletedPrimeInfiniPendingPaymentSession({
      pendingPaymentSession: context.pendingPaymentSession,
      onekeyUserId: context.onekeyUserId,
    }))
  ) {
    return {
      isLoggedIn: true,
      hasPendingPayment: false,
      onekeyUserId: context.onekeyUserId,
    };
  }
  return {
    isLoggedIn: context.isLoggedIn,
    hasPendingPayment: Boolean(context.pendingPaymentSession),
    onekeyUserId: context.onekeyUserId,
  };
}

// Entry gate for every Prime purchase channel, not just the crypto one.
// hasPendingPayment reports whether the user's money is already committed to
// an Infini invoice: replaceable means the invoice was never sent and shows no
// progress, so it can be swapped for a new one, while anything else means a
// broadcast was claimed or funds are moving and a second purchase through any
// channel would charge twice for one subscription. Callers are expected to
// resume the existing crypto flow instead of offering a payment method choice.
export async function getPrimeInfiniPaymentEntryGuard() {
  const context = await getPrimeInfiniPendingPaymentContext();
  const { pendingPaymentSession, onekeyUserId } = context;
  if (!pendingPaymentSession || !onekeyUserId) {
    return {
      isLoggedIn: context.isLoggedIn,
      hasPendingPayment: false,
      onekeyUserId,
      pendingSubscriptionPeriod: undefined,
    };
  }

  let latestPayment: IPrimeInfiniPayment;
  try {
    latestPayment = await backgroundApiProxy.servicePrime.apiGetInfiniPayment({
      paymentId: pendingPaymentSession.paymentCacheKey.paymentId,
      expectedOneKeyUserId: onekeyUserId,
    });
  } catch (error) {
    logPrimeInfiniPaymentFlow({
      stage: 'paymentContext',
      status: 'failed',
      checkoutType: 'internalWallet',
      reason: 'entryGuardPaymentRefreshFailed',
      sendStarted: pendingPaymentSession.sendStarted,
      error,
    });
    // The invoice state is unknown, so neither releasing the session nor
    // opening a second channel is safe. Throwing here used to lock every
    // purchase channel behind a toast until the session TTL, with the one
    // screen that can release the session sitting unreachable behind this
    // gate. Degrade instead — but not on the pre-fetch snapshot alone:
    // another window can atomically claim sendStarted while the fetch is in
    // flight, and a stale "replaceable" verdict would open IAP/Stripe while
    // that broadcast is already authorized. Retiring the session against the
    // current stored state is the proof nothing was claimed: the discard
    // refuses once sendStarted is latched, and a broadcast cannot be marked
    // on a session that no longer exists.
    const localSendStarted =
      pendingPaymentSession.sendStarted ||
      hasPrimeInfiniPaymentProgress(pendingPaymentSession.payment);
    const isLocallyReplaceable = isPrimeInfiniPaymentReplaceable({
      payment: pendingPaymentSession.payment,
      sendStarted: localSendStarted,
    });
    if (
      !isLocallyReplaceable &&
      (await clearCompletedPrimeInfiniPendingPaymentSession({
        pendingPaymentSession,
        onekeyUserId,
      }))
    ) {
      return {
        isLoggedIn: true,
        hasPendingPayment: false,
        onekeyUserId,
        pendingSubscriptionPeriod: undefined,
      };
    }
    if (!isLocallyReplaceable) {
      return {
        isLoggedIn: true,
        hasPendingPayment: true,
        onekeyUserId,
        pendingSubscriptionPeriod:
          pendingPaymentSession.selectedSubscriptionPeriod,
      };
    }
    const didRetireReplaceableSession = await backgroundApiProxy.simpleDb.prime
      .discardUnsentInfiniPendingPaymentSession({
        onekeyUserId,
        expectedPaymentCacheIdentity: pendingPaymentSession.paymentCacheKey,
      })
      .catch((discardError) => {
        logPrimeInfiniPaymentFlow({
          stage: 'paymentSession',
          status: 'failed',
          checkoutType: 'internalWallet',
          reason: 'entryGuardSessionRetirementFailed',
          sendStarted: pendingPaymentSession.sendStarted,
          error: discardError,
        });
        return false;
      });
    if (!didRetireReplaceableSession) {
      throw new OneKeyLocalError({
        message: 'Infini payment session changed while it was being verified',
        autoToast: false,
      });
    }
    return {
      isLoggedIn: true,
      hasPendingPayment: false,
      onekeyUserId,
      pendingSubscriptionPeriod: undefined,
    };
  }
  const paymentWithDurableProgress = mergePrimeInfiniPaymentProgressSnapshot({
    previous: pendingPaymentSession.payment,
    latest: latestPayment,
  });
  const sendStarted =
    pendingPaymentSession.sendStarted ||
    hasPrimeInfiniPaymentProgress(paymentWithDurableProgress);
  if (isPrimeInfiniPaymentClosedUnpaid(paymentWithDurableProgress)) {
    // The invoice is closed server-side with nothing collected. Release the
    // session so the entry gate stops blocking every channel; a claimed but
    // reverted broadcast would otherwise pin it until the session TTL.
    const didDiscard =
      await backgroundApiProxy.simpleDb.prime.discardTerminalInfiniPendingPaymentSession(
        {
          onekeyUserId,
          expectedPaymentCacheIdentity: pendingPaymentSession.paymentCacheKey,
          expectedUpdatedAt: pendingPaymentSession.updatedAt,
          expectedSendStarted: pendingPaymentSession.sendStarted,
          latestPayment,
        },
      );
    if (!didDiscard) {
      throw new OneKeyLocalError({
        message: 'Infini payment session changed while it was being verified',
        autoToast: false,
      });
    }
    return {
      isLoggedIn: true,
      hasPendingPayment: false,
      onekeyUserId,
      pendingSubscriptionPeriod: undefined,
    };
  }

  const hasPendingPayment = !isPrimeInfiniPaymentReplaceable({
    payment: paymentWithDurableProgress,
    sendStarted,
  });

  if (hasPendingPayment) {
    if (
      await clearCompletedPrimeInfiniPendingPaymentSession({
        pendingPaymentSession,
        onekeyUserId,
      })
    ) {
      return {
        isLoggedIn: true,
        hasPendingPayment: false,
        onekeyUserId,
        pendingSubscriptionPeriod: undefined,
      };
    }

    // Latch the observed progress before returning, otherwise a later snapshot
    // that transiently reports zero progress would make this session
    // replaceable again and a second invoice could be sent while the first
    // transaction is still processing. The raw payment is passed through so
    // the merge runs atomically against the stored session.
    const latchedSession =
      await backgroundApiProxy.simpleDb.prime.latchInfiniPendingPaymentSessionProgress(
        {
          onekeyUserId,
          paymentCacheKey: pendingPaymentSession.paymentCacheKey,
          latestPayment,
        },
      );
    // No matching session took the latch, so another window discarded or
    // replaced it while the payment was being fetched and the progress just
    // observed is recorded nowhere. Resuming here would act on a snapshot that
    // no longer describes local state, so fail closed and let the caller retry
    // against a fresh read.
    if (!latchedSession) {
      throw new OneKeyLocalError({
        message: 'Infini payment session changed while it was being verified',
        autoToast: false,
      });
    }
  }

  return {
    isLoggedIn: true,
    hasPendingPayment,
    onekeyUserId,
    // Resuming has to follow the invoice that is already in flight, not a
    // period the user picked afterwards, otherwise the restore silently
    // continues a monthly invoice for a yearly selection.
    pendingSubscriptionPeriod: pendingPaymentSession.selectedSubscriptionPeriod,
  };
}
