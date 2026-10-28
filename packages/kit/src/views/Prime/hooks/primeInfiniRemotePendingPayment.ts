/* cspell:ignore Infini */
import { getPrimeInfiniPaymentValidationFailure } from '@onekeyhq/shared/src/utils/primeInfiniPaymentValidation';
import type {
  IPrimeInfiniPayment,
  IPrimeInfiniPaymentAsset,
  IPrimeInfiniPendingPaymentLookup,
  IPrimeInfiniSubscriptionPlan,
} from '@onekeyhq/shared/types/prime/primeTypes';

import {
  hasPrimeInfiniPaymentProgress,
  isPrimeInfiniPaymentForAsset,
} from './primeInfiniPaymentUtils';

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
  const status = payment.status?.trim().toLowerCase();
  const infiniStatus = payment.infiniStatus?.trim().toLowerCase();
  // Only a clearly unsent invoice can become a transfer on this device.
  const unsentStatuses = new Set(['pending', 'created', 'unpaid']);
  const sendStarted = Boolean(
    pendingPayment?.hasTransactions ||
    hasPrimeInfiniPaymentProgress(payment) ||
    (!status && !infiniStatus) ||
    (status && !unsentStatuses.has(status)) ||
    (infiniStatus && !unsentStatuses.has(infiniStatus)),
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
  return { payment, asset, plan, sendStarted };
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
  }: {
    lookup: IPrimeInfiniPendingPaymentLookup;
    assets: IPrimeInfiniPaymentAsset[];
    choose: (
      canResume: boolean,
    ) => Promise<IPrimeInfiniUnfinishedPaymentChoice>;
    validateAuth: () => Promise<boolean>;
    shouldContinue: () => boolean;
    resumePaymentId?: string;
  }): Promise<IPrimeInfiniRemotePaymentDecision> => {
    if (!shouldContinue()) {
      return { type: 'cancelled' };
    }
    const { pendingPayment, authContext } = lookup;
    if (!pendingPayment) {
      return { type: 'new' };
    }
    const recovery = getPrimeInfiniRemotePaymentRecovery({
      pendingPayment,
      assets,
    });
    const key = JSON.stringify([
      authContext.onekeyUserId,
      authContext.authSessionSource,
      authContext.authStateGeneration,
      pendingPayment.paymentId,
      Boolean(recovery),
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
      return { type: 'new' };
    }
    if (choice === 'resume' && recovery) {
      return { type: 'resume', recovery };
    }
    return { type: 'cancelled' };
  };
}
