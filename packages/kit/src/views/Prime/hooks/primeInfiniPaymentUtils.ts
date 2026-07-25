/* cspell:ignore Infini infini */
import BigNumber from 'bignumber.js';

import { getListedNetworkMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  getPrimeInfiniPaymentAssetKey,
  hasPrimeInfiniPaymentProgressSnapshot,
  isPrimeInfiniPaymentExplicitlyExpiredSnapshot,
  isPrimeInfiniPaymentExplicitlyFailedSnapshot,
  isPrimeInfiniPaymentForAssetSnapshot,
  isPrimeInfiniPaymentFullyConfirmedSnapshot,
  isPrimeInfiniPurchaseCompletedSnapshot,
  isSamePrimeInfiniPaymentAssetIdentity,
  isSamePrimeInfiniPaymentTransferSnapshot,
} from '@onekeyhq/shared/src/utils/primeInfiniPaymentCacheUtils';
import type {
  IPrimeInfiniPayment,
  IPrimeInfiniPaymentAsset,
  IPrimeInfiniPaymentOption,
  IPrimeInfiniSubscription,
  IPrimeSubscriptionInfo,
} from '@onekeyhq/shared/types/prime/primeTypes';

export type { IPrimeInfiniPaymentAsset };

export type IPrimeInfiniPurchaseBaseline = {
  onekeyUserId?: string;
  wasPrimeActive: boolean;
  primeExpiresAt?: number;
  infiniPeriodEnd?: number;
};

export type IPrimeInfiniPaymentOutcome =
  | 'pending'
  | 'confirmed'
  | 'expired'
  | 'failed';

export type IPrimeInfiniPaymentPhase =
  | 'selecting'
  | 'switching'
  | 'replacementFailed'
  | 'retryableFailed'
  | 'creating'
  | 'confirming'
  | 'polling'
  | 'finalizing'
  | 'expired'
  | 'failed';

function isPositiveAmount(value: string | undefined) {
  const amount = new BigNumber(value ?? '');
  return amount.isFinite() && amount.gt(0);
}

export function isPrimeInfiniPaymentExplicitlyExpired(
  payment: IPrimeInfiniPayment,
) {
  return isPrimeInfiniPaymentExplicitlyExpiredSnapshot(payment);
}

export function isPrimeInfiniPaymentExplicitlyFailed(
  payment: IPrimeInfiniPayment,
) {
  return isPrimeInfiniPaymentExplicitlyFailedSnapshot(payment);
}

export function hasPrimeInfiniPaymentConfirmingAmount(
  payment: IPrimeInfiniPayment,
) {
  return isPositiveAmount(payment.amountConfirming);
}

function buildPrimeInfiniPaymentAsset({
  chain,
  token,
  networkId,
  contractAddress,
}: Omit<IPrimeInfiniPaymentAsset, 'key'>):
  | IPrimeInfiniPaymentAsset
  | undefined {
  const normalizedChain = chain.trim().toUpperCase();
  const normalizedToken = token.trim().toUpperCase();
  const normalizedNetworkId = networkId.trim();
  const normalizedContractAddress = contractAddress.trim();
  if (
    !normalizedChain ||
    !normalizedToken ||
    !normalizedNetworkId ||
    !normalizedContractAddress ||
    !Object.prototype.hasOwnProperty.call(
      getListedNetworkMap(),
      normalizedNetworkId,
    )
  ) {
    return undefined;
  }
  return {
    key: getPrimeInfiniPaymentAssetKey({
      chain: normalizedChain,
      token: normalizedToken,
      networkId: normalizedNetworkId,
      contractAddress: normalizedContractAddress,
    }),
    chain: normalizedChain,
    token: normalizedToken,
    networkId: normalizedNetworkId,
    contractAddress: normalizedContractAddress,
  };
}

export function getPrimeInfiniPaymentAssets(
  options: IPrimeInfiniPaymentOption[],
): IPrimeInfiniPaymentAsset[] {
  const assetsBySymbol = new Map<string, IPrimeInfiniPaymentAsset>();
  const ambiguousSymbols = new Set<string>();
  options.forEach((option) => {
    option.tokens.forEach((token) => {
      const asset = buildPrimeInfiniPaymentAsset({
        chain: option.chain,
        token: token.symbol,
        networkId: option.networkId,
        contractAddress: token.contract,
      });
      const symbolKey = asset ? `${asset.chain}-${asset.token}` : '';
      if (!asset || ambiguousSymbols.has(symbolKey)) {
        return;
      }
      const existingAsset = assetsBySymbol.get(symbolKey);
      if (
        existingAsset &&
        !isSamePrimeInfiniPaymentAssetIdentity(existingAsset, asset)
      ) {
        assetsBySymbol.delete(symbolKey);
        ambiguousSymbols.add(symbolKey);
        return;
      }
      assetsBySymbol.set(symbolKey, asset);
    });
  });
  return Array.from(assetsBySymbol.values());
}

export function getCanonicalPrimeInfiniPaymentAsset(
  asset: IPrimeInfiniPaymentAsset,
): IPrimeInfiniPaymentAsset | undefined {
  const canonicalAsset = buildPrimeInfiniPaymentAsset(asset);
  return canonicalAsset?.key === asset.key ? canonicalAsset : undefined;
}

export function isPrimeInfiniPaymentForAsset({
  payment,
  asset,
}: {
  payment: IPrimeInfiniPayment;
  asset: IPrimeInfiniPaymentAsset;
}) {
  return isPrimeInfiniPaymentForAssetSnapshot({ payment, asset });
}

export function shouldBlockPrimeInfiniPaymentRefresh({
  currentPayment,
  refreshedPayment,
  asset,
}: {
  currentPayment: IPrimeInfiniPayment;
  refreshedPayment: IPrimeInfiniPayment;
  asset: IPrimeInfiniPaymentAsset;
}) {
  return (
    !isSamePrimeInfiniPaymentTransferSnapshot({
      first: currentPayment,
      second: refreshedPayment,
      networkId: asset.networkId,
    }) ||
    !isPrimeInfiniPaymentForAsset({
      payment: refreshedPayment,
      asset,
    })
  );
}

export function isPrimeInfiniBalanceSufficient({
  balance,
  amountDue,
}: {
  balance: string | undefined;
  amountDue: string;
}) {
  const balanceValue = new BigNumber(balance ?? '');
  const amountDueValue = new BigNumber(amountDue);
  return (
    balanceValue.isFinite() &&
    amountDueValue.isFinite() &&
    amountDueValue.gt(0) &&
    balanceValue.gte(amountDueValue)
  );
}

export function getPrimeInfiniPaymentCountdown({
  expiresAt,
  now = Date.now(),
}: {
  expiresAt: number;
  now?: number;
}) {
  const remainingSeconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const displayRemainingSeconds = Math.max(0, remainingSeconds - 1);
  const hours = Math.floor(displayRemainingSeconds / 3600);
  const minutes = Math.floor((displayRemainingSeconds % 3600) / 60);
  const seconds = displayRemainingSeconds % 60;
  const formatted = [hours, minutes, seconds]
    .slice(hours > 0 ? 0 : 1)
    .map((value) => value.toString().padStart(2, '0'))
    .join(':');

  return {
    formatted,
    isExpired: remainingSeconds === 0,
    remainingSeconds,
  };
}

export function isPrimeInfiniPaymentWithinSendSafetyWindow({
  payment,
  minValidityBeforeSendMs,
  now = Date.now(),
}: {
  payment: IPrimeInfiniPayment;
  minValidityBeforeSendMs: number;
  now?: number;
}) {
  return payment.expiresAt <= now + minValidityBeforeSendMs;
}

export function getPrimeInfiniPaymentOutcome({
  payment,
  now = Date.now(),
}: {
  payment: IPrimeInfiniPayment;
  now?: number;
}): IPrimeInfiniPaymentOutcome {
  if (isPrimeInfiniPaymentFullyConfirmedSnapshot(payment)) {
    return 'confirmed';
  }
  if (isPrimeInfiniPaymentExplicitlyExpired(payment)) {
    return 'expired';
  }
  if (isPrimeInfiniPaymentExplicitlyFailed(payment)) {
    return 'failed';
  }
  if (payment.expiresAt <= now) {
    return 'expired';
  }
  return 'pending';
}

export function hasPrimeInfiniPaymentProgress(payment: IPrimeInfiniPayment) {
  return hasPrimeInfiniPaymentProgressSnapshot(payment);
}

export function isPrimeInfiniPaymentReplaceable({
  payment,
  sendStarted,
}: {
  payment: IPrimeInfiniPayment;
  sendStarted: boolean;
}) {
  return !sendStarted && !hasPrimeInfiniPaymentProgress(payment);
}

export function canChangePrimeInfiniPaymentSelection({
  phase,
  payment,
  sendStarted,
}: {
  phase: IPrimeInfiniPaymentPhase;
  payment: IPrimeInfiniPayment | undefined;
  sendStarted: boolean;
}) {
  const canRecoverByChangingSelection =
    phase === 'selecting' ||
    phase === 'replacementFailed' ||
    phase === 'retryableFailed' ||
    phase === 'expired' ||
    phase === 'failed';
  return (
    canRecoverByChangingSelection &&
    (!payment ||
      isPrimeInfiniPaymentReplaceable({
        payment,
        sendStarted,
      }))
  );
}

export function shouldRenderPrimeInfiniPaymentSelection({
  phase,
}: {
  phase: IPrimeInfiniPaymentPhase;
}) {
  return phase !== 'finalizing';
}

export function getPrimeInfiniPaymentErrorRecoveryPhase({
  sendStarted,
}: {
  sendStarted: boolean;
}): Extract<IPrimeInfiniPaymentPhase, 'polling' | 'retryableFailed'> {
  return sendStarted ? 'polling' : 'retryableFailed';
}

export function isPrimeInfiniPurchaseCompleted({
  baseline,
  primeSubscription,
  infiniSubscription,
}: {
  baseline: IPrimeInfiniPurchaseBaseline;
  primeSubscription: IPrimeSubscriptionInfo | undefined;
  infiniSubscription: IPrimeInfiniSubscription | undefined;
}) {
  return isPrimeInfiniPurchaseCompletedSnapshot({
    baseline,
    purchaseStatusSnapshot: {
      onekeyUserId: baseline.onekeyUserId ?? '',
      primeSubscription,
      infiniSubscription,
    },
  });
}
