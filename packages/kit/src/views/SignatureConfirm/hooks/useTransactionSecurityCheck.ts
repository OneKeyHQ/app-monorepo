import { useCallback, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { makeTimeoutPromise } from '@onekeyhq/shared/src/background/backgroundUtils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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
  resolveTransactionSecurityApplicability,
  resolveTransactionSecurityCheckState,
  runTransactionSecurityChecks,
} from './transactionSecurityCheck';

import type {
  ITransactionSecurityCheckParams,
  ITransactionSecurityEncodedTxInput,
} from './transactionSecurityCheck';

// Include auth refresh and IPC in the limit, not only the service's HTTP call.
const checkTransactionSecurity = makeTimeoutPromise({
  asyncFunc: async (
    params: Parameters<
      typeof backgroundApiProxy.serviceSignatureConfirm.checkTransactionSecurity
    >[0],
  ) =>
    backgroundApiProxy.serviceSignatureConfirm.checkTransactionSecurity(params),
  timeout: 10_000,
  timeoutRejectError: new OneKeyLocalError(
    'Transaction security check timed out',
  ),
});

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
          return checkTransactionSecurity({
            accountId: encodedTx.accountId ?? accountId,
            networkId: encodedTx.networkId ?? networkId,
            encodedTx: encodedTx.encodedTx,
          });
        }),
      );
    }
    if (jsonRpc) {
      return await checkTransactionSecurity({
        accountId,
        networkId,
        jsonRpc,
      });
    }
    return undefined;
  } catch {
    // The service maps POST failures; this also covers IPC and the deadline.
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
  const [user] = usePrimePersistAtom();
  const { result: eligibility, run: resolveEligibility } = usePromiseResult(
    async () => {
      try {
        const { isLoggedIn, isLoggedInOnServer, primeSubscription } =
          await makeTimeoutPromise({
            asyncFunc: async () =>
              backgroundApiProxy.servicePrime.getLocalUserInfo(),
            timeout: 10_000,
            timeoutRejectError: new OneKeyLocalError(
              'Transaction security eligibility timed out',
            ),
          })(undefined);
        return {
          user,
          isPrimeUser: Boolean(
            isLoggedIn && isLoggedInOnServer && primeSubscription?.isActive,
          ),
        };
      } catch {
        return { user, isPrimeUser: undefined };
      }
    },
    [user],
    { undefinedResultIfReRun: true, checkIsFocused: false },
  );
  // Eligibility depends on bg-owned auth state, not the lazy Prime UI effect.
  // A previous user's result must not unlock this request while revalidating.
  const currentEligibility =
    eligibility?.user === user ? eligibility : undefined;
  const isPrimeUser = currentEligibility?.isPrimeUser;
  const isEligibilityFailed = Boolean(
    currentEligibility && isPrimeUser === undefined,
  );
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
  const shouldCheck = isPrimeUser === true && hasScannableRequest;
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
    if (isEligibilityFailed) {
      void resolveEligibility();
    } else if (shouldCheck) {
      void run();
    }
  }, [isEligibilityFailed, resolveEligibility, run, shouldCheck]);

  return useMemo(
    () => ({
      ...resolveTransactionSecurityCheckState({
        shouldCheck,
        isEligibilityPending: !currentEligibility && hasScannableRequest,
        requestKey: scanRequestKey,
        resolvedRequestKey: resolved?.requestKey,
        result: resolved?.result,
        isLoading,
      }),
      ...(isEligibilityFailed && hasScannableRequest
        ? { result: createCheckFailedTransactionSecurityResult() }
        : {}),
      requestKey: scanRequestKey,
      isApplicable,
      isPrimeUser,
      retry:
        shouldCheck || (isEligibilityFailed && hasScannableRequest)
          ? retry
          : undefined,
    }),
    [
      hasScannableRequest,
      currentEligibility,
      isEligibilityFailed,
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
