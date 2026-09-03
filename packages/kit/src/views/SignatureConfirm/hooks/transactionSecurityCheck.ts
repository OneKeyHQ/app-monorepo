import type { IEncodedTx } from '@onekeyhq/core/src/types';
import {
  canAttemptTransactionSecurityEncodedTx,
  canSubmitTransactionSecurityJsonRpc,
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

export function getTransactionSecurityEncodedTxs(
  unsignedTxs?: ITransactionSecurityCheckParams['unsignedTxs'],
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
  return encodedTxs.length ? encodedTxs : EMPTY_ENCODED_TXS;
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

export function resolveTransactionSecurityCheckState({
  shouldCheck,
  requestKey,
  resolvedRequestKey,
  result,
  isLoading,
}: {
  shouldCheck: boolean;
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
    isPending: shouldCheck && (!isCurrent || isLoading !== false),
  };
}
