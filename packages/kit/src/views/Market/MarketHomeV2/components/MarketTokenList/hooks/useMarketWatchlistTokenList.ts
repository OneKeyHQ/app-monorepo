import { useEffect, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import {
  SORT_MAP,
  getNetworkLogoUri,
  transformApiItemToToken,
} from '../utils/tokenListHelpers';

import type { IMarketToken } from '../MarketTokenData';

export interface IUseMarketWatchlistTokenListParams {
  watchlist: IMarketWatchListItemV2[];
  sortBy?: string;
  sortType?: 'asc' | 'desc';
  pageSize?: number;
  minLiquidity?: number;
  maxLiquidity?: number;
}

export function useMarketWatchlistTokenList({
  watchlist,
  sortBy,
  sortType,
  pageSize = 20,
  minLiquidity,
  maxLiquidity,
}: IUseMarketWatchlistTokenListParams) {
  const [currentPage, setCurrentPage] = useState(1);
  const [transformedData, setTransformedData] = useState<IMarketToken[]>([]);

  const { result: apiResult, isLoading } = usePromiseResult(
    async () => {
      if (!watchlist || watchlist.length === 0) return { list: [] } as const;
      const tokenAddressList = watchlist.map((item) => ({
        chainId: item.chainId,
        contractAddress: item.contractAddress,
        isNative: false,
      }));
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch({
          tokenAddressList,
        });
      return response;
    },
    [watchlist],
    {
      watchLoading: true,
    },
  );

  useEffect(() => {
    if (!apiResult || !apiResult.list) return;

    // Map contractAddress to chainId for quick lookup
    const chainIdMap: Record<string, string> = {};
    watchlist.forEach((w) => {
      chainIdMap[w.contractAddress.toLowerCase()] = w.chainId;
    });

    const transformed: IMarketToken[] = apiResult.list.map((item) => {
      const chainId = chainIdMap[item.address.toLowerCase()] || '';
      const networkLogoUri = getNetworkLogoUri(chainId);
      return transformApiItemToToken(item, {
        chainId,
        networkLogoUri,
      });
    });

    setTransformedData(transformed);
  }, [apiResult, watchlist]);

  // Apply liquidity filter
  const filteredData = useMemo(() => {
    let res = transformedData;
    if (typeof minLiquidity === 'number') {
      res = res.filter((d) => d.liquidity >= minLiquidity);
    }
    if (typeof maxLiquidity === 'number') {
      res = res.filter((d) => d.liquidity <= maxLiquidity);
    }
    return res;
  }, [transformedData, minLiquidity, maxLiquidity]);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortBy || !sortType) return filteredData;
    const key = SORT_MAP[sortBy] || sortBy;
    return [...filteredData].sort((a, b) => {
      const av = a[key] as number;
      const bv = b[key] as number;
      if (av === bv) return 0;
      return sortType === 'asc' ? av - bv : bv - av;
    });
  }, [filteredData, sortBy, sortType]);

  const totalCount = sortedData.length;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1;

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  return {
    data: paginatedData,
    isLoading,
    currentPage,
    totalPages,
    totalCount,
    setCurrentPage,
    refetch: () => {
      /* no-op for now */
    },
  } as const;
}
