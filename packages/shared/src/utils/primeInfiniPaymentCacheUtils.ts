/* cspell:ignore Infini */
import BigNumber from 'bignumber.js';

import { generateUUID } from './miscUtils';
import { normalizeTokenContractAddress } from './tokenUtils';

import type {
  IPrimeInfiniPayment,
  IPrimeInfiniPaymentAsset,
  IPrimeInfiniPaymentCacheIdentity,
  IPrimeInfiniPaymentCacheKey,
  IPrimeInfiniPaymentTransferClaim,
  IPrimeInfiniPendingPaymentSession,
  IPrimeInfiniPurchaseStatusSnapshot,
  IPrimeInfiniSubscriptionPlan,
} from '../../types/prime/primeTypes';

const FAILED_PAYMENT_STATUSES = new Set([
  'cancelled',
  'canceled',
  'failed',
  'failure',
]);
const EXPIRED_PAYMENT_STATUSES = new Set([
  'expired',
  'expire',
  'timeout',
  'timed_out',
]);
const SUCCESSFUL_PAYMENT_STATUSES = new Set([
  'confirmed',
  'completed',
  'paid',
  'success',
  'succeeded',
]);
function normalizeIdentityValue(value: string) {
  return value.trim().toUpperCase();
}

function normalizePaymentStatus(value: string | undefined) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getPositiveAmount(value: string | undefined) {
  const amount = new BigNumber(value ?? '');
  return amount.isFinite() && amount.gt(0) ? amount : undefined;
}

function getMaximumPaymentProgressAmount(
  first: string | undefined,
  second: string | undefined,
) {
  const firstAmount = getPositiveAmount(first);
  const secondAmount = getPositiveAmount(second);
  if (!firstAmount) {
    return second;
  }
  if (!secondAmount) {
    return first;
  }
  return firstAmount.gte(secondAmount) ? first : second;
}

function normalizeNetworkAddress({
  networkId,
  address,
}: {
  networkId: string;
  address: string;
}) {
  return (
    normalizeTokenContractAddress({
      networkId: networkId.trim(),
      contractAddress: address.trim(),
    }) ?? ''
  );
}

export function normalizePrimeInfiniContractAddress({
  networkId,
  contractAddress,
}: {
  networkId: string;
  contractAddress: string;
}) {
  return normalizeNetworkAddress({
    networkId,
    address: contractAddress,
  });
}

export function isSamePrimeInfiniNetworkAddress({
  networkId,
  first,
  second,
}: {
  networkId: string;
  first: string;
  second: string;
}) {
  return (
    normalizeNetworkAddress({ networkId, address: first }) ===
    normalizeNetworkAddress({ networkId, address: second })
  );
}

export function getPrimeInfiniPaymentAssetKey(
  asset: Omit<IPrimeInfiniPaymentAsset, 'key'>,
) {
  return [
    normalizeIdentityValue(asset.chain),
    normalizeIdentityValue(asset.token),
    asset.networkId.trim(),
    normalizePrimeInfiniContractAddress(asset),
  ].join(':');
}

export function isSamePrimeInfiniPaymentAssetIdentity(
  first: Pick<IPrimeInfiniPaymentAsset, 'networkId' | 'contractAddress'>,
  second: Pick<IPrimeInfiniPaymentAsset, 'networkId' | 'contractAddress'>,
) {
  return (
    first.networkId.trim() === second.networkId.trim() &&
    normalizePrimeInfiniContractAddress(first) ===
      normalizePrimeInfiniContractAddress(second)
  );
}

export function buildPrimeInfiniPaymentCacheKey({
  bindingId,
  payment,
  asset,
  onekeyUserId,
  plan,
  payerAccountId,
  payerAddress,
}: {
  bindingId: string;
  payment: IPrimeInfiniPayment;
  asset: IPrimeInfiniPaymentAsset;
  onekeyUserId: string;
  plan: IPrimeInfiniSubscriptionPlan;
  payerAccountId: string;
  payerAddress: string;
}): IPrimeInfiniPaymentCacheKey {
  return {
    bindingId,
    paymentId: payment.paymentId,
    networkId: asset.networkId.trim(),
    contractAddress: normalizePrimeInfiniContractAddress(asset),
    onekeyUserId,
    plan,
    payerAccountId,
    payerAddress: normalizeNetworkAddress({
      networkId: asset.networkId,
      address: payerAddress,
    }),
  };
}

export function isSamePrimeInfiniPaymentCacheKey(
  first: IPrimeInfiniPaymentCacheKey,
  second: IPrimeInfiniPaymentCacheKey,
) {
  return (
    first.bindingId === second.bindingId &&
    first.paymentId === second.paymentId &&
    isSamePrimeInfiniPaymentAssetIdentity(first, second) &&
    first.onekeyUserId === second.onekeyUserId &&
    first.plan === second.plan &&
    first.payerAccountId === second.payerAccountId &&
    isSamePrimeInfiniNetworkAddress({
      networkId: first.networkId,
      first: first.payerAddress,
      second: second.payerAddress,
    })
  );
}

export function isPrimeInfiniPaymentCacheIdentityForKey(
  identity: IPrimeInfiniPaymentCacheIdentity,
  cacheKey: IPrimeInfiniPaymentCacheKey,
) {
  return (
    identity.paymentId === cacheKey.paymentId &&
    isSamePrimeInfiniPaymentAssetIdentity(identity, cacheKey)
  );
}

export function isPrimeInfiniPaymentCacheKeyForContext({
  cacheKey,
  payment,
  asset,
  onekeyUserId,
  plan,
  payerAccountId,
  payerAddress,
}: {
  cacheKey: IPrimeInfiniPaymentCacheKey;
  payment: IPrimeInfiniPayment;
  asset: IPrimeInfiniPaymentAsset;
  onekeyUserId: string;
  plan: IPrimeInfiniSubscriptionPlan;
  payerAccountId: string;
  payerAddress: string;
}) {
  return isSamePrimeInfiniPaymentCacheKey(
    cacheKey,
    buildPrimeInfiniPaymentCacheKey({
      bindingId: cacheKey.bindingId,
      payment,
      asset,
      onekeyUserId,
      plan,
      payerAccountId,
      payerAddress,
    }),
  );
}

export function createPrimeInfiniPaymentBindingId() {
  return generateUUID();
}

export function isPrimeInfiniPaymentTransferClaimForSession({
  session,
  transferClaim,
}: {
  session: IPrimeInfiniPendingPaymentSession;
  transferClaim: IPrimeInfiniPaymentTransferClaim;
}) {
  const transferAmount = new BigNumber(transferClaim.amount);
  const invoiceAmount = new BigNumber(session.payment.amountDue);
  return (
    transferClaim.networkId.trim() === session.asset.networkId.trim() &&
    transferClaim.accountId === session.payerAccountId &&
    isSamePrimeInfiniNetworkAddress({
      networkId: session.asset.networkId,
      first: transferClaim.accountAddress,
      second: session.payerAddress,
    }) &&
    isSamePrimeInfiniNetworkAddress({
      networkId: session.asset.networkId,
      first: transferClaim.fromAddress,
      second: session.payerAddress,
    }) &&
    isSamePrimeInfiniNetworkAddress({
      networkId: session.asset.networkId,
      first: transferClaim.toAddress,
      second: session.payment.address,
    }) &&
    isSamePrimeInfiniPaymentAssetIdentity(
      {
        networkId: transferClaim.networkId,
        contractAddress: transferClaim.contractAddress,
      },
      session.asset,
    ) &&
    transferAmount.isFinite() &&
    transferAmount.gt(0) &&
    invoiceAmount.isFinite() &&
    invoiceAmount.gt(0) &&
    transferAmount.eq(invoiceAmount)
  );
}

export function isPrimeInfiniPaymentPreBroadcastSnapshotSendable({
  payment,
  paymentCacheKey,
  transferClaim,
  now = Date.now(),
}: {
  payment: IPrimeInfiniPayment;
  paymentCacheKey: IPrimeInfiniPaymentCacheKey;
  transferClaim: IPrimeInfiniPaymentTransferClaim;
  now?: number;
}) {
  const paymentAmount = new BigNumber(payment.amountDue);
  const transferAmount = new BigNumber(transferClaim.amount);
  return (
    payment.paymentId === paymentCacheKey.paymentId &&
    transferClaim.networkId === paymentCacheKey.networkId &&
    transferClaim.accountId === paymentCacheKey.payerAccountId &&
    isSamePrimeInfiniNetworkAddress({
      networkId: paymentCacheKey.networkId,
      first: transferClaim.accountAddress,
      second: paymentCacheKey.payerAddress,
    }) &&
    isSamePrimeInfiniNetworkAddress({
      networkId: paymentCacheKey.networkId,
      first: transferClaim.fromAddress,
      second: paymentCacheKey.payerAddress,
    }) &&
    isSamePrimeInfiniNetworkAddress({
      networkId: paymentCacheKey.networkId,
      first: transferClaim.toAddress,
      second: payment.address,
    }) &&
    isSamePrimeInfiniPaymentAssetIdentity(
      {
        networkId: transferClaim.networkId,
        contractAddress: transferClaim.contractAddress,
      },
      paymentCacheKey,
    ) &&
    paymentAmount.isFinite() &&
    paymentAmount.gt(0) &&
    transferAmount.isFinite() &&
    transferAmount.eq(paymentAmount) &&
    !hasPrimeInfiniPaymentProgressSnapshot(payment) &&
    !isPrimeInfiniPaymentExplicitlyFailedSnapshot(payment) &&
    !isPrimeInfiniPaymentExplicitlyExpiredSnapshot(payment) &&
    !isPrimeInfiniPaymentExplicitlySuccessfulSnapshot(payment) &&
    now < payment.expiresAt
  );
}

export function isPrimeInfiniPurchaseCompletedSnapshot({
  baseline,
  purchaseStatusSnapshot,
}: {
  baseline: Pick<
    IPrimeInfiniPendingPaymentSession['baseline'],
    'wasPrimeActive' | 'primeExpiresAt' | 'infiniPeriodEnd'
  >;
  purchaseStatusSnapshot: IPrimeInfiniPurchaseStatusSnapshot;
}) {
  const { primeSubscription, infiniSubscription } = purchaseStatusSnapshot;
  if (!baseline.wasPrimeActive) {
    return Boolean(primeSubscription?.isActive);
  }
  if (
    baseline.primeExpiresAt !== undefined &&
    primeSubscription?.isActive &&
    primeSubscription.expiresAt > baseline.primeExpiresAt
  ) {
    return true;
  }
  return Boolean(
    baseline.infiniPeriodEnd !== undefined &&
    infiniSubscription?.currentPeriodEnd &&
    infiniSubscription.currentPeriodEnd > baseline.infiniPeriodEnd,
  );
}

export function isPrimeInfiniPaymentForAssetSnapshot({
  payment,
  asset,
}: {
  payment: IPrimeInfiniPayment;
  asset: IPrimeInfiniPaymentAsset;
}) {
  const amount = new BigNumber(payment.amountDue);
  return (
    normalizeIdentityValue(payment.chain) ===
      normalizeIdentityValue(asset.chain) &&
    normalizeIdentityValue(payment.token) ===
      normalizeIdentityValue(asset.token) &&
    amount.isFinite() &&
    amount.gt(0)
  );
}

export function hasPrimeInfiniPaymentProgressSnapshot(
  payment: IPrimeInfiniPayment,
) {
  return Boolean(
    getPositiveAmount(payment.amountConfirmed) ||
    getPositiveAmount(payment.amountConfirming),
  );
}

export function isPrimeInfiniPaymentExplicitlyFailedSnapshot(
  payment: IPrimeInfiniPayment,
) {
  return (
    FAILED_PAYMENT_STATUSES.has(normalizePaymentStatus(payment.status)) ||
    FAILED_PAYMENT_STATUSES.has(normalizePaymentStatus(payment.infiniStatus))
  );
}

export function isPrimeInfiniPaymentExplicitlyExpiredSnapshot(
  payment: IPrimeInfiniPayment,
) {
  return (
    EXPIRED_PAYMENT_STATUSES.has(normalizePaymentStatus(payment.status)) ||
    EXPIRED_PAYMENT_STATUSES.has(normalizePaymentStatus(payment.infiniStatus))
  );
}

export function isPrimeInfiniPaymentExplicitlySuccessfulSnapshot(
  payment: IPrimeInfiniPayment,
) {
  return (
    SUCCESSFUL_PAYMENT_STATUSES.has(normalizePaymentStatus(payment.status)) ||
    SUCCESSFUL_PAYMENT_STATUSES.has(
      normalizePaymentStatus(payment.infiniStatus),
    )
  );
}

export function isPrimeInfiniPaymentFullyConfirmedSnapshot(
  payment: IPrimeInfiniPayment,
) {
  const amountDue = new BigNumber(payment.amountDue);
  const amountConfirmed = new BigNumber(payment.amountConfirmed ?? '');
  return (
    amountDue.isFinite() &&
    amountDue.gt(0) &&
    amountConfirmed.isFinite() &&
    amountConfirmed.gte(amountDue)
  );
}

export function mergePrimeInfiniPaymentProgressSnapshot({
  previous,
  latest,
}: {
  previous: IPrimeInfiniPayment;
  latest: IPrimeInfiniPayment;
}) {
  if (previous.paymentId !== latest.paymentId) {
    return latest;
  }
  const latestHasSuccessfulOutcome =
    isPrimeInfiniPaymentExplicitlySuccessfulSnapshot(latest) ||
    isPrimeInfiniPaymentFullyConfirmedSnapshot(latest);
  const preservePreviousTerminalStatus =
    !latestHasSuccessfulOutcome &&
    (isPrimeInfiniPaymentExplicitlyFailedSnapshot(previous) ||
      isPrimeInfiniPaymentExplicitlyExpiredSnapshot(previous) ||
      isPrimeInfiniPaymentExplicitlySuccessfulSnapshot(previous) ||
      isPrimeInfiniPaymentFullyConfirmedSnapshot(previous));
  return {
    ...latest,
    status: preservePreviousTerminalStatus ? previous.status : latest.status,
    infiniStatus: preservePreviousTerminalStatus
      ? previous.infiniStatus
      : latest.infiniStatus,
    amountConfirmed: getMaximumPaymentProgressAmount(
      previous.amountConfirmed,
      latest.amountConfirmed,
    ),
    amountConfirming: getMaximumPaymentProgressAmount(
      previous.amountConfirming,
      latest.amountConfirming,
    ),
  };
}

export function isSamePrimeInfiniPaymentTransferSnapshot({
  first,
  second,
  networkId,
}: {
  first: IPrimeInfiniPayment;
  second: IPrimeInfiniPayment;
  networkId: string;
}) {
  const firstAmount = new BigNumber(first.amountDue);
  const secondAmount = new BigNumber(second.amountDue);
  return (
    first.paymentId === second.paymentId &&
    normalizeNetworkAddress({
      networkId,
      address: first.address,
    }) ===
      normalizeNetworkAddress({
        networkId,
        address: second.address,
      }) &&
    normalizeIdentityValue(first.chain) ===
      normalizeIdentityValue(second.chain) &&
    normalizeIdentityValue(first.token) ===
      normalizeIdentityValue(second.token) &&
    firstAmount.isFinite() &&
    firstAmount.gt(0) &&
    secondAmount.isFinite() &&
    secondAmount.gt(0) &&
    firstAmount.eq(secondAmount) &&
    first.expiresAt === second.expiresAt
  );
}
