import { useCallback, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuthMethods } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { usePrimeInitAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  canAttemptTransactionSecurityEncodedTx,
  createCheckFailedTransactionSecurityResult,
} from '@onekeyhq/shared/src/utils/transactionSecurityUtils';
import type {
  ITransactionSecurityCheckResult,
  ITransactionSecurityJsonRpc,
} from '@onekeyhq/shared/types/transactionSecurity';

import {
  getTransactionSecurityEncodedTxs,
  getTransactionSecurityRequestKey,
  hasScannableTransactionSecurityRequest,
  resolvePrimeUserForSecurityCheck,
  resolveTransactionSecurityApplicability,
  resolveTransactionSecurityCheckState,
  runTransactionSecurityChecks,
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
      return runTransactionSecurityChecks(
        encodedTxs.map((encodedTx) => () => {
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
  const [{ isReady: isPrimePersistReady }] = usePrimeInitAtom();
  const isPrimeUser = resolvePrimeUserForSecurityCheck({
    isPrimeSubscriptionActive,
    isPersistReady: isPrimePersistReady,
  });
  const encodedTxs = useMemo(
    () => getTransactionSecurityEncodedTxs(unsignedTxs),
    [unsignedTxs],
  );
  const scanRequestKey = useMemo(
    () =>
      getTransactionSecurityRequestKey({
        requestKey,
        origin,
        accountId,
        networkId,
        encodedTxs,
        jsonRpc,
      }),
    [accountId, encodedTxs, jsonRpc, networkId, origin, requestKey],
  );
  const hasScannableRequest = hasScannableTransactionSecurityRequest({
    origin,
    accountId,
    networkId,
    encodedTxs,
    jsonRpc,
  });
  const shouldResolveApplicability =
    isPrimeUser === false && hasScannableRequest;
  const { result: networkApplicability } = usePromiseResult(
    async () => {
      if (!shouldResolveApplicability || !networkId) {
        return undefined;
      }
      try {
        return {
          networkId,
          isCustomNetwork:
            await backgroundApiProxy.serviceNetwork.isCustomNetwork({
              networkId,
            }),
        };
      } catch {
        return undefined;
      }
    },
    [networkId, shouldResolveApplicability],
    {
      undefinedResultIfReRun: true,
      checkIsFocused: false,
    },
  );
  const isApplicable =
    isPrimeUser === false
      ? resolveTransactionSecurityApplicability({
          hasScannableRequest,
          networkId,
          resolvedNetworkId: networkApplicability?.networkId,
          isCustomNetwork: networkApplicability?.isCustomNetwork,
        })
      : undefined;
  const shouldCheck = isPrimeSubscriptionActive === true && hasScannableRequest;
  const {
    result: resolved,
    isLoading,
    run,
  } = usePromiseResult(
    async () => {
      if (!shouldCheck || !accountId || !networkId) {
        return undefined;
      }
      return {
        requestKey: scanRequestKey,
        result: await fetchTransactionSecurityCheck({
          accountId,
          networkId,
          encodedTxs,
          jsonRpc,
        }),
      };
    },
    // scanRequestKey already captures every request input and its semantic
    // payload identity; object identities here would rescan fee-only changes.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [scanRequestKey, shouldCheck],
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
        requestKey: scanRequestKey,
        resolvedRequestKey: resolved?.requestKey,
        result: resolved?.result,
        isLoading,
      }),
      requestKey: scanRequestKey,
      isApplicable,
      isPrimeUser,
      retry: shouldCheck ? retry : undefined,
    }),
    [
      hasScannableRequest,
      isLoading,
      isApplicable,
      isPrimeUser,
      resolved,
      retry,
      scanRequestKey,
      shouldCheck,
    ],
  );
}
