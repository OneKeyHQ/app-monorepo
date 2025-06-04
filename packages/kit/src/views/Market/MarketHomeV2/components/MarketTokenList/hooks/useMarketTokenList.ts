import { useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';

import type { IMarketToken } from '../MarketTokenData';

interface IUseMarketTokenListParams {
  networkId: string;
  sortBy?: string;
  sortType?: 'asc' | 'desc';
  pageSize?: number;
}

function transformApiDataToComponentData(
  apiData: IMarketTokenListItem[],
): IMarketToken[] {
  return apiData.map((item, index) => ({
    id: item.address || `${index}`,
    name: item.name,
    symbol: item.symbol,
    address: item.address,
    price: parseFloat(item.price || '0'),
    change24h: parseFloat(item.priceChange24hPercent || '0'),
    marketCap: parseFloat(item.marketCap || '0'),
    liquidity: parseFloat(item.tvl || '0'),
    transactions: parseInt(item.trade24hCount || '0', 10),
    uniqueTraders: parseInt(item.uniqueWallet24h || '0', 10),
    holders: item.holders || 0,
    turnover: parseFloat(item.volume24h || '0'),
    tokenImageUri: item.logoUrl || '',
    networkLogoUri: '',
    walletInfo: undefined,
  }));
}

export function useMarketTokenList({
  networkId,
  sortBy,
  sortType,
  pageSize = 10,
}: IUseMarketTokenListParams) {
  const [currentPage, setCurrentPage] = useState(1);

  const {
    result: apiResult,
    isLoading,
    run: fetchMarketTokenList,
  } = usePromiseResult(
    async () => {
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenList({
          networkId,
          sortBy,
          sortType,
          page: currentPage,
          limit: pageSize,
        });
      return response;
    },
    [networkId, sortBy, sortType, currentPage, pageSize],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 30 }),
    },
  );

  const transformedData = useMemo(() => {
    if (!apiResult?.list) return [];
    return transformApiDataToComponentData(apiResult.list);
  }, [apiResult?.list]);

  const totalCount = apiResult?.total || 0;

  const paginatedData = useMemo(() => {
    return transformedData;
  }, [transformedData]);

  const totalPages = useMemo(() => {
    return totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1;
  }, [totalCount, pageSize]);

  return {
    data: paginatedData,
    isLoading,
    currentPage,
    totalPages,
    totalCount,
    setCurrentPage,
    refetch: fetchMarketTokenList,
  };
}
