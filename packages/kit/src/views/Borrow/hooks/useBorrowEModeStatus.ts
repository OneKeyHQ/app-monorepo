import { useEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EBorrowProviderEnum } from '@onekeyhq/shared/types/staking';
import type { IBorrowEModeStatus } from '@onekeyhq/shared/types/staking';

interface IUseBorrowEModeStatusParams {
  networkId?: string;
  provider?: string;
  marketAddress?: string;
  accountId?: string;
  enabled?: boolean;
}

type IScopedEModeResult = {
  scopeKey: string;
  eModeStatus: IBorrowEModeStatus | null;
  state: 'resolved' | 'error';
};

export const useBorrowEModeStatus = ({
  networkId,
  provider,
  marketAddress,
  accountId,
  enabled = true,
}: IUseBorrowEModeStatusParams) => {
  const scopeKey = JSON.stringify([
    networkId,
    provider?.toLowerCase(),
    marketAddress,
    accountId,
    enabled,
  ]);
  const lastSuccessfulStatusRef = useRef<{
    scopeKey: string;
    eModeStatus: IBorrowEModeStatus;
  } | null>(null);
  const requestParams = useMemo(
    () =>
      networkId &&
      provider &&
      marketAddress &&
      accountId &&
      enabled &&
      provider.toLowerCase() === EBorrowProviderEnum.Aave
        ? { networkId, provider, marketAddress, accountId }
        : null,
    [accountId, enabled, marketAddress, networkId, provider],
  );
  const canRequestStatus = Boolean(requestParams);
  const {
    result: scopedResult,
    run,
    isLoading,
  } = usePromiseResult(
    async (): Promise<IScopedEModeResult> => {
      // e-mode is an Aave-only feature; never query it for other providers
      // (e.g. Kamino), which the backend rejects with "not implemented".
      if (!requestParams) {
        return { scopeKey, eModeStatus: null, state: 'resolved' };
      }
      try {
        return {
          scopeKey,
          eModeStatus:
            await backgroundApiProxy.serviceStaking.getBorrowEModeStatus(
              requestParams,
            ),
          state: 'resolved',
        };
      } catch {
        return {
          scopeKey,
          eModeStatus:
            lastSuccessfulStatusRef.current?.scopeKey === scopeKey
              ? lastSuccessfulStatusRef.current.eModeStatus
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
      checkIsFocused: true,
      revalidateOnFocus: true,
      undefinedResultIfError: true,
    },
  );

  const hasResolvedCurrentScope = scopedResult?.scopeKey === scopeKey;
  const eModeStatus = hasResolvedCurrentScope ? scopedResult.eModeStatus : null;
  const isError =
    canRequestStatus &&
    hasResolvedCurrentScope &&
    scopedResult?.state === 'error';
  useEffect(() => {
    if (eModeStatus) {
      lastSuccessfulStatusRef.current = { scopeKey, eModeStatus };
    }
  }, [eModeStatus, scopeKey]);

  return {
    eModeStatus,
    isInitialLoading: canRequestStatus && !hasResolvedCurrentScope,
    isLoading,
    isError,
    refresh: run,
  };
};
