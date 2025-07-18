import { useCallback, useEffect, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import {
  getNetworkLogoUri,
  transformApiItemToToken,
} from '../utils/tokenListHelpers';

import type { IMarketToken } from '../MarketTokenData';

interface IUseMarketTokenListParams {
  networkId: string;
  initialSortBy?: string;
  initialSortType?: 'asc' | 'desc';
  pageSize?: number;
  minLiquidity?: number;
  maxLiquidity?: number;
}

export function useMarketTokenList({
  networkId,
  initialSortBy,
  initialSortType,
  pageSize = 50,
  minLiquidity,
  maxLiquidity,
}: IUseMarketTokenListParams) {
  const [transformedData, setTransformedData] = useState<IMarketToken[]>([]);
  const [sortBy, setSortBy] = useState<string | undefined>(
    initialSortBy || 'v24hUSD',
  );
  const [sortType, setSortType] = useState<'asc' | 'desc' | undefined>(
    initialSortType || 'desc',
  );

  const {
    result: apiResult,
    isLoading,
    run: fetchMarketTokenList,
  } = usePromiseResult(
    async () => {
      // Fetch 3 pages in parallel
      const promises = [1, 2, 3, 4, 5].map((page) =>
        backgroundApiProxy.serviceMarketV2.fetchMarketTokenList({
          networkId,
          sortBy,
          sortType,
          page,
          limit: pageSize,
          minLiquidity,
          maxLiquidity,
        }),
      );

      const responses = await Promise.all(promises);

      // Combine all pages into a single response
      const combinedList = responses.flatMap((response) => response.list);
      const totalCount = responses[0]?.total || 0;

      return {
        list: combinedList,
        total: totalCount,
      };
    },
    [networkId, sortBy, sortType, pageSize, minLiquidity, maxLiquidity],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 60 }),
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  useEffect(() => {
    if (!apiResult || !apiResult.list) {
      return;
    }

    const networkLogoUri = getNetworkLogoUri(networkId);
    const transformed = apiResult.list.map((item, idx) =>
      transformApiItemToToken(item, {
        chainId: networkId,
        networkLogoUri,
        index: idx,
      }),
    );

    // Update data only after successful fetch (preserve existing data during loading)
    setTransformedData(transformed);
  }, [apiResult, networkId]);

  // Don't clear data immediately when dependencies change - let new data load first
  // The data will be updated when the new API result arrives

  const totalCount = apiResult?.total || 0;

  const totalPages = useMemo(() => {
    return totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1;
  }, [totalCount, pageSize]);

  const refresh = useCallback(() => {
    // Don't clear data immediately - let new data load first
    void fetchMarketTokenList();
  }, [fetchMarketTokenList]);

  return {
    data: transformedData,
    isLoading,
    totalPages,
    totalCount,
    refresh,
    refetch: fetchMarketTokenList,
    sortBy,
    sortType,
    setSortBy,
    setSortType,
  } as const;
}
