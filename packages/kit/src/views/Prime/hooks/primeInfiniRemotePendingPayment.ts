/* cspell:ignore Infini */
import BigNumber from 'bignumber.js';

import { getPrimeInfiniPaymentValidationFailure } from '@onekeyhq/shared/src/utils/primeInfiniPaymentValidation';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
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
  if (!payment || (plan !== 'monthly' && plan !== 'yearly')) return undefined;
  const unsentStatuses = new Set(['pending', 'created', 'unpaid']);
  const statuses = [payment.status, payment.infiniStatus].filter(
    (status): status is string =>
      typeof status === 'string' && status.length > 0,
  );
  // Existing wallet preparation can resume an unpaid quote. It cannot safely
  // reconstruct another device's payer or transaction from partial progress.
  if (
    pendingPayment.hasLocalSendEvidence ||
    pendingPayment.hasTransactions !== false ||
    !statuses.length ||
    !statuses.every((status) =>
      unsentStatuses.has(status.trim().toLowerCase()),
    ) ||
    !new BigNumber(payment.amountConfirmed ?? 'NaN').eq(0) ||
    !new BigNumber(payment.amountConfirming ?? 'NaN').eq(0)
  )
    return undefined;
  const asset = assets.find((item) =>
    isPrimeInfiniPaymentForAsset({ payment, asset: item }),
  );
  if (!asset || getPrimeInfiniPaymentValidationFailure({ payment, asset }))
    return undefined;
  return { payment, asset, plan };
}

export async function preparePrimeInfiniRemotePayment({
  recovery,
  asset,
  fetchLookup,
  createPayment,
  chooseNew,
  validateAuth,
  shouldContinue,
}: {
  recovery: IPrimeInfiniRemotePaymentRecovery;
  asset: IPrimeInfiniPaymentAsset;
  fetchLookup: () => Promise<IPrimeInfiniPendingPaymentLookup>;
  createPayment: () => Promise<IPrimeInfiniPayment>;
  chooseNew: (
    lookupUnavailable: boolean,
  ) => Promise<IPrimeInfiniUnfinishedPaymentChoice>;
  validateAuth: () => Promise<boolean>;
  shouldContinue: () => boolean;
}): Promise<{ payment: IPrimeInfiniPayment; resumed: boolean } | undefined> {
  const lookup = await fetchLookup();
  if (!shouldContinue() || !(await validateAuth()) || !shouldContinue())
    return undefined;
  const latest =
    lookup.status !== 'unavailable'
      ? getPrimeInfiniRemotePaymentRecovery({
          pendingPayment: lookup.pendingPayment,
          assets: [asset],
        })
      : undefined;
  if (
    latest &&
    latest.plan === recovery.plan &&
    latest.payment.paymentId === recovery.payment.paymentId &&
    !getPrimeInfiniPaymentValidationFailure({
      payment: latest.payment,
      previousPayment: recovery.payment,
      asset,
    })
  )
    return { payment: latest.payment, resumed: true };
  // A stale/incomplete recovery is a warning with an exit to a new purchase,
  // not a new payment lock. No payer, transaction or old quote is guessed.
  const choice = await chooseNew(
    lookup.status === 'unavailable' || !lookup.pendingPayment,
  );
  if (
    choice !== 'replace' ||
    !shouldContinue() ||
    !(await validateAuth()) ||
    !shouldContinue()
  )
    return undefined;
  return { payment: await createPayment(), resumed: false };
}

export type IPrimeInfiniRemotePaymentDecision =
  | { type: 'new' }
  | { type: 'resume'; recovery: IPrimeInfiniRemotePaymentRecovery }
  | { type: 'cancelled' };

export function createPrimeInfiniRemotePendingPaymentResolver() {
  // UI retries share a dialog only while the account and full lookup agree.
  // This is never persisted and never changes any transaction/send admission.
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
      lookupUnavailable?: boolean,
    ) => Promise<IPrimeInfiniUnfinishedPaymentChoice>;
    validateAuth: () => Promise<boolean>;
    shouldContinue: () => boolean;
    resumePaymentId?: string;
    allowNewPayment?: boolean;
  }): Promise<IPrimeInfiniRemotePaymentDecision> => {
    if (!shouldContinue() || !(await validateAuth()) || !shouldContinue())
      return { type: 'cancelled' };
    const { pendingPayment } = lookup;
    const lookupUnavailable =
      lookup.status === 'unavailable' ||
      Boolean(resumePaymentId && !pendingPayment);
    if (!pendingPayment && !lookupUnavailable)
      return { type: allowNewPayment ? 'new' : 'cancelled' };
    const candidate = !lookupUnavailable
      ? getPrimeInfiniRemotePaymentRecovery({ pendingPayment, assets })
      : undefined;
    const recovery =
      !resumePaymentId || resumePaymentId === candidate?.payment.paymentId
        ? candidate
        : undefined;
    const key = stringUtils.stableStringify([
      lookup,
      Boolean(recovery),
      resumePaymentId,
    ]);
    if (previousChoice?.key !== key) {
      let promise: Promise<IPrimeInfiniUnfinishedPaymentChoice>;
      if (recovery && resumePaymentId === recovery.payment.paymentId)
        promise = Promise.resolve('resume');
      else if (lookupUnavailable) promise = choose(false, true);
      else promise = choose(Boolean(recovery));
      previousChoice = { key, promise };
    }
    const pendingChoice = previousChoice;
    const choice = await pendingChoice.promise;
    if (choice === 'cancel' && previousChoice === pendingChoice)
      previousChoice = undefined;
    if (!shouldContinue() || !(await validateAuth()) || !shouldContinue())
      return { type: 'cancelled' };
    // The warning is advisory. An explicit new-payment choice always returns
    // to the existing purchase flow; it creates no durable duplicate fence.
    if (choice === 'replace') return { type: 'new' };
    if (choice === 'resume' && recovery) return { type: 'resume', recovery };
    return { type: 'cancelled' };
  };
}
