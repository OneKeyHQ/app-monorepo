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

  return {
    isLoggedIn: true,
    hasPendingPayment: !isPrimeInfiniPaymentReplaceable({
      payment: paymentWithDurableProgress,
      sendStarted,
    }),
    onekeyUserId,
  };
}
