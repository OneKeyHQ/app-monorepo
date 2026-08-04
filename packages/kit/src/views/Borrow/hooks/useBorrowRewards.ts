import { useEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IBorrowRewards } from '@onekeyhq/shared/types/staking';

type IScopedBorrowRewardsResult = {
  scopeKey: string;
  data: IBorrowRewards | null;
  state: 'resolved' | 'error';
};

export const useBorrowRewards = ({
  networkId,
  provider,
  marketAddress,
  accountId,
  enabled = true,
}: {
  networkId?: string;
  provider?: string;
  marketAddress?: string;
  accountId?: string;
  enabled?: boolean;
}) => {
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
    data: IBorrowRewards;
  } | null>(null);
  const {
    result: scopedResult,
    run,
    isLoading,
  } = usePromiseResult(
    async (): Promise<IScopedBorrowRewardsResult> => {
      if (!requestParams) {
        return { scopeKey, data: null, state: 'resolved' };
      }
      try {
        return {
          scopeKey,
          data: await backgroundApiProxy.serviceStaking.getBorrowRewards(
            requestParams,
          ),
          state: 'resolved',
        };
      } catch {
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
      alwaysSetState: true,
    },
  );
  const hasSettledCurrentScope = scopedResult?.scopeKey === scopeKey;
  const borrowRewards = hasSettledCurrentScope ? scopedResult.data : null;
  useEffect(() => {
    if (borrowRewards && scopedResult?.state === 'resolved') {
      lastSuccessfulResultRef.current = { scopeKey, data: borrowRewards };
    }
  }, [borrowRewards, scopeKey, scopedResult?.state]);

  return {
    borrowRewards,
    isInitialLoading: Boolean(requestParams) && !hasSettledCurrentScope,
    isLoading,
    refresh: run,
  };
};
