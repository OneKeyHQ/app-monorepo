import type { IEncodedTx } from '@onekeyhq/core/src/types';
import {
  PROMISE_CONCURRENCY_LIMIT,
  promiseAllSettledEnhanced,
} from '@onekeyhq/shared/src/utils/promiseUtils';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import {
  canAttemptTransactionSecurityEncodedTx,
  canSubmitTransactionSecurityJsonRpc,
  createCheckFailedTransactionSecurityResult,
  getTransactionSecurityEncodedTxIdentity,
  mergeTransactionSecurityResults,
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
  return stableStringify({
    accountId: encodedTx.accountId ?? '',
    networkId: encodedTx.networkId ?? '',
    encodedTx: getTransactionSecurityEncodedTxIdentity(encodedTx.encodedTx),
  });
}

export function getTransactionSecurityRequestKey({
  requestKey,
  origin,
  accountId,
  networkId,
  encodedTxs,
  jsonRpc,
}: {
  requestKey: string;
  origin?: string;
  accountId?: string;
  networkId?: string;
  encodedTxs?: ITransactionSecurityEncodedTxInput[];
  jsonRpc?: ITransactionSecurityJsonRpc;
}) {
  return stableStringify({
    requestKey,
    origin: origin ?? '',
    accountId: accountId ?? '',
    networkId: networkId ?? '',
    encodedTxs: encodedTxs?.map(getEncodedTxInputIdentity) ?? [],
    jsonRpc: jsonRpc ?? null,
  });
}

export async function runTransactionSecurityChecks(
  checks: Array<() => Promise<ITransactionSecurityCheckResult | undefined>>,
) {
  try {
    const results = await promiseAllSettledEnhanced(
      checks.map((check) => async () => check()),
      {
        continueOnError: true,
        concurrency: PROMISE_CONCURRENCY_LIMIT,
      },
    );
    return mergeTransactionSecurityResults(
      results.map((result) =>
        result === null ? createCheckFailedTransactionSecurityResult() : result,
      ),
    );
  } catch {
    return createCheckFailedTransactionSecurityResult();
  }
}

export function resolveTransactionSecurityApplicability({
  hasScannableRequest,
  networkId,
  resolvedNetworkId,
  isCustomNetwork,
}: {
  hasScannableRequest: boolean;
  networkId?: string;
  resolvedNetworkId?: string;
  isCustomNetwork?: boolean;
}): boolean | undefined {
  if (!hasScannableRequest) {
    return false;
  }
  if (!networkId || resolvedNetworkId !== networkId) {
    return undefined;
  }
  return !isCustomNetwork;
}

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

export function hasScannableTransactionSecurityRequest({
  origin,
  accountId,
  networkId,
  encodedTxs,
  jsonRpc,
}: Pick<
  ITransactionSecurityCheckParams,
  'origin' | 'accountId' | 'networkId' | 'jsonRpc'
> & {
  encodedTxs?: ITransactionSecurityEncodedTxInput[];
}) {
  return Boolean(
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
