import { useCallback, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuthMethods } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { usePrimeInitAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
  resolvePrimeUserForSecurityCheck,
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
    if (encodedTxs?.length) {
      const results = await Promise.all(
        encodedTxs.map((encodedTx) => {
          if (!canAttemptTransactionSecurityEncodedTx(encodedTx.encodedTx)) {
            return Promise.resolve(undefined);
          }
          return backgroundApiProxy.serviceSignatureConfirm.checkTransactionSecurity(
            {
              accountId: encodedTx.accountId ?? accountId,
              networkId: encodedTx.networkId ?? networkId,
              encodedTx: encodedTx.encodedTx,
            },
          );
        }),
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

export function useSecurityCheckPrimeUser() {
  const { isPrimeSubscriptionActive } = useOneKeyAuthMethods();
  const [{ isReady: isPersistReady }] = usePrimeInitAtom();
  return {
    isPrimeSubscriptionActive: isPrimeSubscriptionActive === true,
    isPrimeUser: resolvePrimeUserForSecurityCheck({
      isPrimeSubscriptionActive,
      isPersistReady,
    }),
  };
}

export function useTransactionSecurityCheck({
  requestKey,
  origin,
  accountId,
  networkId,
  unsignedTxs,
  jsonRpc,
}: ITransactionSecurityCheckParams) {
  const { isPrimeSubscriptionActive, isPrimeUser } =
    useSecurityCheckPrimeUser();
  const encodedTxsRef = useRef(getTransactionSecurityEncodedTxs());
  const encodedTxs = useMemo(() => {
    const next = getTransactionSecurityEncodedTxs(
      unsignedTxs,
      encodedTxsRef.current,
    );
    encodedTxsRef.current = next;
    return next;
  }, [unsignedTxs]);
  const hasScannableRequest = shouldRunTransactionSecurityCheck({
    isPrimeSubscriptionActive: true,
    origin,
    accountId,
    networkId,
    encodedTxs,
    jsonRpc,
  });
  const shouldCheck = isPrimeSubscriptionActive && hasScannableRequest;
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
      checkIsFocused: false,
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
        isEligibilityPending: isPrimeUser === undefined && hasScannableRequest,
        requestKey,
        resolvedRequestKey: resolved?.requestKey,
        result: resolved?.result,
        isLoading,
      }),
      isPrimeUser,
      retry: shouldCheck ? retry : undefined,
    }),
    [
      hasScannableRequest,
      isLoading,
      isPrimeUser,
      requestKey,
      resolved,
      retry,
      shouldCheck,
    ],
  );
}
