/* cspell:ignore Infini */
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { mergePrimeInfiniPaymentProgressSnapshot } from '@onekeyhq/shared/src/utils/primeInfiniPaymentCacheUtils';
import type { IPrimeInfiniPendingPaymentSession } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  hasPrimeInfiniPaymentProgress,
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

export async function getPrimeInfiniExternalCheckoutGuard() {
  const context = await getPrimeInfiniPendingPaymentContext();
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
    };
  }

  const latestPayment =
    await backgroundApiProxy.servicePrime.apiGetInfiniPayment({
      paymentId: pendingPaymentSession.paymentCacheKey.paymentId,
      expectedOneKeyUserId: onekeyUserId,
    });
  const paymentWithDurableProgress = mergePrimeInfiniPaymentProgressSnapshot({
    previous: pendingPaymentSession.payment,
    latest: latestPayment,
  });
  const sendStarted =
    pendingPaymentSession.sendStarted ||
    hasPrimeInfiniPaymentProgress(paymentWithDurableProgress);
  const hasPendingPayment = !isPrimeInfiniPaymentReplaceable({
    payment: paymentWithDurableProgress,
    sendStarted,
  });

  if (hasPendingPayment) {
    // Latch the observed progress before returning, otherwise a later snapshot
    // that transiently reports zero progress would make this session
    // replaceable again and a second invoice could be sent while the first
    // transaction is still processing. The raw payment is passed through so
    // the merge runs atomically against the stored session.
    await backgroundApiProxy.simpleDb.prime.latchInfiniPendingPaymentSessionProgress(
      {
        onekeyUserId,
        paymentCacheKey: pendingPaymentSession.paymentCacheKey,
        latestPayment,
      },
    );
  }

  return {
    isLoggedIn: true,
    hasPendingPayment,
    onekeyUserId,
  };
}
