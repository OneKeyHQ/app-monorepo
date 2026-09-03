import type { IEncodedTx } from '@onekeyhq/core/src/types';
import {
  canAttemptTransactionSecurityEncodedTx,
  canSubmitTransactionSecurityJsonRpc,
  getTransactionSecurityEncodedTxIdentity,
} from '@onekeyhq/shared/src/utils/transactionSecurityUtils';
import type {
  ITransactionSecurityCheckResult,
  ITransactionSecurityJsonRpc,
} from '@onekeyhq/shared/types/transactionSecurity';

export type ITransactionSecurityEncodedTxInput = {
  encodedTx: IEncodedTx;
  accountId?: string;
  networkId?: string;
};

export type ITransactionSecurityCheckParams = {
  requestKey: string;
  origin?: string;
  accountId?: string;
  networkId?: string;
  unsignedTxs?: Array<{
    encodedTx?: IEncodedTx;
    accountId?: string;
    networkId?: string;
  }>;
  jsonRpc?: ITransactionSecurityJsonRpc;
};

const EMPTY_ENCODED_TXS: ITransactionSecurityEncodedTxInput[] = [];

function getEncodedTxInputIdentity(
  encodedTx: ITransactionSecurityEncodedTxInput,
) {
  return [
    encodedTx.accountId ?? '',
    encodedTx.networkId ?? '',
    getTransactionSecurityEncodedTxIdentity(encodedTx.encodedTx),
  ].join(':');
}

export function getTransactionSecurityEncodedTxs(
  unsignedTxs?: ITransactionSecurityCheckParams['unsignedTxs'],
  previous: ITransactionSecurityEncodedTxInput[] = EMPTY_ENCODED_TXS,
): ITransactionSecurityEncodedTxInput[] {
  if (!unsignedTxs?.length) {
    return EMPTY_ENCODED_TXS;
  }
  const encodedTxs = unsignedTxs.flatMap((unsignedTx) =>
    unsignedTx.encodedTx
      ? [
          {
            encodedTx: unsignedTx.encodedTx,
            accountId: unsignedTx.accountId,
            networkId: unsignedTx.networkId,
          },
        ]
      : [],
  );
  const next = encodedTxs.length ? encodedTxs : EMPTY_ENCODED_TXS;
  if (
    next.length === previous.length &&
    next.every(
      (item, index) =>
        getEncodedTxInputIdentity(item) ===
        getEncodedTxInputIdentity(previous[index]),
    )
  ) {
    return previous;
  }
  return next;
}

export function shouldRunTransactionSecurityCheck({
  isPrimeSubscriptionActive,
  origin,
  accountId,
  networkId,
  encodedTxs,
  jsonRpc,
}: Pick<
  ITransactionSecurityCheckParams,
  'origin' | 'accountId' | 'networkId' | 'jsonRpc'
> & {
  isPrimeSubscriptionActive: boolean;
  encodedTxs?: ITransactionSecurityEncodedTxInput[];
}) {
  return Boolean(
    isPrimeSubscriptionActive &&
    origin &&
    accountId &&
    networkId &&
    (encodedTxs?.some((item) =>
      canAttemptTransactionSecurityEncodedTx(item.encodedTx),
    ) ||
      canSubmitTransactionSecurityJsonRpc(jsonRpc)),
  );
}

// Persist writes `primeSubscription: undefined` for logged-in free users, so
// `isLoggedIn && isLoggedInOnServer && subscription?.isActive` is undefined.
// That is "known free", not "membership unknown". Only persist-not-ready
// stays undefined so the card does not flash Get Prime.
export function resolvePrimeUserForSecurityCheck({
  isPrimeSubscriptionActive,
  isPersistReady,
}: {
  isPrimeSubscriptionActive?: boolean;
  isPersistReady: boolean;
}): boolean | undefined {
  if (!isPersistReady) {
    return undefined;
  }
  return isPrimeSubscriptionActive === true;
}

export function resolveTransactionSecurityCheckState({
  shouldCheck,
  isEligibilityPending,
  requestKey,
  resolvedRequestKey,
  result,
  isLoading,
}: {
  shouldCheck: boolean;
  isEligibilityPending?: boolean;
  requestKey: string;
  resolvedRequestKey?: string;
  result?: ITransactionSecurityCheckResult;
  isLoading?: boolean;
}): {
  result?: ITransactionSecurityCheckResult;
  isPending: boolean;
} {
  const isCurrent = shouldCheck && resolvedRequestKey === requestKey;
  return {
    result: isCurrent ? result : undefined,
    isPending:
      Boolean(isEligibilityPending) ||
      (shouldCheck && (!isCurrent || isLoading !== false)),
  };
}
