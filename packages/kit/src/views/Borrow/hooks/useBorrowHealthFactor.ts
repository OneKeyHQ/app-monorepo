import { useEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IBorrowHealthFactor } from '@onekeyhq/shared/types/staking';

interface IUseBorrowHealthFactorParams {
  networkId?: string;
  provider?: string;
  marketAddress?: string;
  accountId?: string;
  enabled?: boolean;
}

const POLLING_INTERVAL = 30 * 1000; // 30 seconds

type IScopedHealthFactorResult = {
  scopeKey: string;
  data: IBorrowHealthFactor | null;
  state: 'resolved' | 'error';
};

export const useBorrowHealthFactor = ({
  networkId,
  provider,
  marketAddress,
  accountId,
  enabled = true,
}: IUseBorrowHealthFactorParams) => {
  const scopeKey = JSON.stringify([
    networkId,
    provider?.toLowerCase(),
    marketAddress,
    accountId,
    enabled,
  ]);
  const requestParams = useMemo(
    () =>
      networkId && provider && marketAddress && accountId && enabled
        ? { networkId, provider, marketAddress, accountId }
        : null,
    [accountId, enabled, marketAddress, networkId, provider],
  );
  const lastSuccessfulResultRef = useRef<{
    scopeKey: string;
    data: IBorrowHealthFactor;
  } | null>(null);
  const {
    result: scopedResult,
    run,
    isLoading,
  } = usePromiseResult(
    async (): Promise<IScopedHealthFactorResult> => {
      if (!requestParams) {
        return { scopeKey, data: null, state: 'resolved' };
      }
      try {
        return {
          scopeKey,
          data: await backgroundApiProxy.serviceStaking.getBorrowHealthFactor(
            requestParams,
          ),
          state: 'resolved',
        };
      } catch (error) {
        defaultLogger.app.error.log(
          `Borrow health factor request failed: ${String(error)}`,
        );
        return {
          scopeKey,
          data:
            lastSuccessfulResultRef.current?.scopeKey === scopeKey
              ? lastSuccessfulResultRef.current.data
              : null,
          state: 'error',
        };
      }
    },
    [requestParams, scopeKey],
    {
      initResult: null,
      watchLoading: true,
      pollingInterval: POLLING_INTERVAL,
      revalidateOnFocus: true,
      // Fix: Ensure API responses update state even when page loses focus during request
      alwaysSetState: true,
    },
  );
  const hasSettledCurrentScope = scopedResult?.scopeKey === scopeKey;
  const healthFactorData = hasSettledCurrentScope ? scopedResult.data : null;
  const isError =
    Boolean(requestParams) &&
    hasSettledCurrentScope &&
    (scopedResult?.state === 'error' || !healthFactorData);
  useEffect(() => {
    if (healthFactorData && scopedResult?.state === 'resolved') {
      lastSuccessfulResultRef.current = { scopeKey, data: healthFactorData };
    }
  }, [healthFactorData, scopeKey, scopedResult?.state]);

  return {
    healthFactorData,
    isInitialLoading: Boolean(requestParams) && !hasSettledCurrentScope,
    isLoading,
    isError,
    refresh: run,
  };
};
