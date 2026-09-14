import { useCallback, useEffect, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { buildMarketHolderPercentages } from './useMarketHolders.utils';
import { useTokenDetail } from './useTokenDetail';

interface IUseMarketHoldersProps {
  tokenAddress: string;
  networkId: string;
}

export function useMarketHolders({
  tokenAddress,
  networkId,
}: IUseMarketHoldersProps) {
  const { tokenDetail } = useTokenDetail();
  const tokenKey = `${networkId}:${tokenAddress}`;
  const [cachedTokenDetail, setCachedTokenDetail] = useState<
    | {
        tokenKey: string;
        detail: IMarketTokenDetail;
      }
    | undefined
  >();

  useEffect(() => {
    if (
      tokenDetail?.fdv &&
      tokenDetail.price &&
      tokenDetail.networkId === networkId &&
      tokenDetail.address.toLowerCase() === tokenAddress.toLowerCase()
    ) {
      setCachedTokenDetail({
        tokenKey,
        detail: tokenDetail,
      });
      return;
    }

    setCachedTokenDetail((previous) =>
      previous?.tokenKey === tokenKey ? previous : undefined,
    );
  }, [networkId, tokenAddress, tokenDetail, tokenKey]);

  const {
    result: holdersData,
    isLoading: isRefreshing,
    run: fetchHolders,
  } = usePromiseResult(
    async () => {
      return backgroundApiProxy.serviceMarketV2.fetchMarketTokenHolders({
        tokenAddress,
        networkId,
      });
    },
    [tokenAddress, networkId],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 5 }),
    },
  );

  const onRefresh = useCallback(async () => {
    await fetchHolders();
  }, [fetchHolders]);
  const holders = useMemo(
    () =>
      buildMarketHolderPercentages({
        holders: holdersData?.list ?? [],
        tokenDetail:
          cachedTokenDetail?.tokenKey === tokenKey
            ? cachedTokenDetail.detail
            : undefined,
      }),
    [cachedTokenDetail, holdersData?.list, tokenKey],
  );

  return {
    holders,
    fetchHolders,
    isRefreshing,
    onRefresh,
  };
}
