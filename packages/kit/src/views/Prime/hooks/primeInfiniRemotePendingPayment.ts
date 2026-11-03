/* cspell:ignore Infini */
import { isPrimeInfiniRemotePaymentTrackingOnlySnapshot } from '@onekeyhq/shared/src/utils/primeInfiniPaymentCacheUtils';
import { getPrimeInfiniPaymentValidationFailure } from '@onekeyhq/shared/src/utils/primeInfiniPaymentValidation';
import type {
  IPrimeInfiniPayment,
  IPrimeInfiniPaymentAsset,
  IPrimeInfiniPendingPaymentLookup,
  IPrimeInfiniSubscriptionPlan,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { isPrimeInfiniPaymentForAsset } from './primeInfiniPaymentUtils';

export type IPrimeInfiniUnfinishedPaymentChoice =
  | 'replace'
  | 'resume'
  | 'cancel';

export type IPrimeInfiniRemotePaymentRecovery = {
  payment: IPrimeInfiniPayment;
  asset: IPrimeInfiniPaymentAsset;
  plan: IPrimeInfiniSubscriptionPlan;
  sendStarted: boolean;
};

export function getPrimeInfiniRemotePaymentRecovery({
  pendingPayment,
  assets,
}: {
  pendingPayment: IPrimeInfiniPendingPaymentLookup['pendingPayment'];
  assets: IPrimeInfiniPaymentAsset[];
}): IPrimeInfiniRemotePaymentRecovery | undefined {
  const payment = pendingPayment?.payment;
  const plan = pendingPayment?.plan;
  if (!payment || (plan !== 'monthly' && plan !== 'yearly')) {
    return undefined;
  }
  const asset = assets.find((item) =>
    isPrimeInfiniPaymentForAsset({ payment, asset: item }),
  );
  // Only a clearly unsent invoice can become a transfer on this device.
  const sendStarted = Boolean(
    pendingPayment?.hasTransactions ||
    isPrimeInfiniRemotePaymentTrackingOnlySnapshot(payment),
  );
  if (
    !asset ||
    getPrimeInfiniPaymentValidationFailure({
      payment,
      asset,
      validateQuote: !sendStarted,
    })
  ) {
    return undefined;
  }
  return {
    payment: pendingPayment?.hasTransactions
      ? { ...payment, hasTransactions: true }
      : payment,
    asset,
    plan,
    sendStarted,
  };
}

export type IPrimeInfiniRemotePaymentDecision =
  | { type: 'new' }
  | { type: 'resume'; recovery: IPrimeInfiniRemotePaymentRecovery }
  | { type: 'cancelled' };

export function createPrimeInfiniRemotePendingPaymentResolver() {
  let previousChoice:
    | { key: string; promise: Promise<IPrimeInfiniUnfinishedPaymentChoice> }
    | undefined;
  return async ({
    lookup,
    assets,
    choose,
    validateAuth,
    shouldContinue,
    resumePaymentId,
    allowNewPayment = true,
  }: {
    lookup: IPrimeInfiniPendingPaymentLookup;
    assets: IPrimeInfiniPaymentAsset[];
    choose: (
      canResume: boolean,
    ) => Promise<IPrimeInfiniUnfinishedPaymentChoice>;
    validateAuth: () => Promise<boolean>;
    shouldContinue: () => boolean;
    resumePaymentId?: string;
    allowNewPayment?: boolean;
  }): Promise<IPrimeInfiniRemotePaymentDecision> => {
    if (!shouldContinue()) {
      return { type: 'cancelled' };
    }
    const { pendingPayment, authContext } = lookup;
    if (!pendingPayment) {
      return allowNewPayment &&
        !resumePaymentId &&
        (await validateAuth()) &&
        shouldContinue()
        ? { type: 'new' }
        : { type: 'cancelled' };
    }
    const recovery = getPrimeInfiniRemotePaymentRecovery({
      pendingPayment,
      assets,
    });
    // A resume intent authorizes only its original invoice, never a new one.
    if (
      (resumePaymentId && resumePaymentId !== recovery?.payment.paymentId) ||
      (!allowNewPayment && !recovery)
    ) {
      return { type: 'cancelled' };
    }
    const key = JSON.stringify([
      authContext.onekeyUserId,
      authContext.authSessionSource,
      authContext.authStateGeneration,
      pendingPayment.paymentId,
      Boolean(recovery),
      pendingPayment.hasTransactions,
      recovery?.sendStarted,
      allowNewPayment,
      resumePaymentId,
    ]);
    // Loader retries share one prompt and one consent for this order/lifecycle.
    if (previousChoice?.key !== key) {
      previousChoice = {
        key,
        promise:
          recovery && resumePaymentId === recovery.payment.paymentId
            ? Promise.resolve('resume')
            : choose(Boolean(recovery)),
      };
    }
    const choice = await previousChoice.promise;
    if (!shouldContinue() || !(await validateAuth()) || !shouldContinue()) {
      return { type: 'cancelled' };
    }
    if (choice === 'replace') {
      return allowNewPayment && !resumePaymentId
        ? { type: 'new' }
        : { type: 'cancelled' };
    }
    if (choice === 'resume' && recovery) {
      return { type: 'resume', recovery };
    }
    return { type: 'cancelled' };
  };
}
