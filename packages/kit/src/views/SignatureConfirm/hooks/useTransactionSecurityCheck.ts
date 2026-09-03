import { useCallback, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuthMethods } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  canAttemptTransactionSecurityEncodedTx,
  createCheckFailedTransactionSecurityResult,
  mergeTransactionSecurityResults,
} from '@onekeyhq/shared/src/utils/transactionSecurityUtils';
import type {
  ITransactionSecurityCheckResult,
  ITransactionSecurityJsonRpc,
} from '@onekeyhq/shared/types/transactionSecurity';

import {
  getTransactionSecurityEncodedTxs,
  resolveTransactionSecurityCheckState,
  shouldRunTransactionSecurityCheck,
} from './transactionSecurityCheck';

import type {
  ITransactionSecurityCheckParams,
  ITransactionSecurityEncodedTxInput,
} from './transactionSecurityCheck';

async function fetchTransactionSecurityCheck({
  accountId,
  networkId,
  encodedTxs,
  jsonRpc,
}: {
  accountId: string;
  networkId: string;
  encodedTxs?: ITransactionSecurityEncodedTxInput[];
  jsonRpc?: ITransactionSecurityJsonRpc;
}): Promise<ITransactionSecurityCheckResult | undefined> {
  try {
    const sendableEncodedTxs = encodedTxs?.filter((encodedTx) =>
      canAttemptTransactionSecurityEncodedTx(encodedTx.encodedTx),
    );
    if (sendableEncodedTxs?.length) {
      const results = await Promise.all(
        sendableEncodedTxs.map((encodedTx) =>
          backgroundApiProxy.serviceSignatureConfirm.checkTransactionSecurity({
            accountId: encodedTx.accountId ?? accountId,
            networkId: encodedTx.networkId ?? networkId,
            encodedTx: encodedTx.encodedTx,
          }),
        ),
      );
      return mergeTransactionSecurityResults(results);
    }
    if (jsonRpc) {
      return await backgroundApiProxy.serviceSignatureConfirm.checkTransactionSecurity(
        {
          accountId,
          networkId,
          jsonRpc,
        },
      );
    }
    return undefined;
  } catch {
    // The service already maps scan POST failures. This is leftover IPC.
    return createCheckFailedTransactionSecurityResult();
  }
}

export function useTransactionSecurityCheck({
  requestKey,
  origin,
  accountId,
  networkId,
  unsignedTxs,
  jsonRpc,
}: ITransactionSecurityCheckParams) {
  const { isPrimeSubscriptionActive } = useOneKeyAuthMethods();
  const encodedTxs = useMemo(
    () => getTransactionSecurityEncodedTxs(unsignedTxs),
    [unsignedTxs],
  );
  const shouldCheck = shouldRunTransactionSecurityCheck({
    isPrimeSubscriptionActive: !!isPrimeSubscriptionActive,
    origin,
    accountId,
    networkId,
    encodedTxs,
    jsonRpc,
  });
  const {
    result: resolved,
    isLoading,
    run,
  } = usePromiseResult(
    async () => {
      if (!shouldCheck || !accountId || !networkId) {
        return {
          requestKey,
          result: undefined,
        };
      }
      return {
        requestKey,
        result: await fetchTransactionSecurityCheck({
          accountId,
          networkId,
          encodedTxs,
          jsonRpc,
        }),
      };
    },
    [accountId, encodedTxs, jsonRpc, networkId, requestKey, shouldCheck],
    {
      watchLoading: true,
      undefinedResultIfReRun: true,
    },
  );
  const retry = useCallback(() => {
    if (!shouldCheck) {
      return;
    }
    void run();
  }, [run, shouldCheck]);

  return useMemo(
    () => ({
      ...resolveTransactionSecurityCheckState({
        shouldCheck,
        requestKey,
        resolvedRequestKey: resolved?.requestKey,
        result: resolved?.result,
        isLoading,
      }),
      isPrimeUser: isPrimeSubscriptionActive,
      retry: shouldCheck ? retry : undefined,
    }),
    [
      isLoading,
      isPrimeSubscriptionActive,
      requestKey,
      resolved,
      retry,
      shouldCheck,
    ],
  );
}
