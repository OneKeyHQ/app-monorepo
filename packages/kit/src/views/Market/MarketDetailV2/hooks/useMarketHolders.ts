import { useCallback, useEffect, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { buildMarketHolderPercentages } from './useMarketHolders.utils';
import { useMarketTokenListRequest } from './useMarketTokenListRequest';
import { useTokenDetail } from './useTokenDetail';

interface IUseMarketHoldersProps {
  tokenAddress: string;
  networkId: string;
  isTabFocused?: boolean;
}

export function useMarketHolders({
  tokenAddress,
  networkId,
  isTabFocused = true,
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
    if (!isTabFocused) {
      setCachedTokenDetail((previous) =>
        previous?.tokenKey === tokenKey ? previous : undefined,
      );
      return;
    }
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
  }, [isTabFocused, networkId, tokenAddress, tokenDetail, tokenKey]);

  const {
    result: holdersData,
    isLoading: isRefreshing,
    isInitialPending,
    run: fetchHolders,
  } = useMarketTokenListRequest(
    async () => {
      return backgroundApiProxy.serviceMarketV2.fetchMarketTokenHolders({
        tokenAddress,
        networkId,
      });
    },
    {
      tokenAddress,
      networkId,
      isTabFocused,
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
    isInitialPending,
    onRefresh,
  };
}
