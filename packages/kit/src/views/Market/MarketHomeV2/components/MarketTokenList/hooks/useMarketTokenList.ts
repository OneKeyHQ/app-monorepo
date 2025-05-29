import { useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';

import type { IRiskIndicatorType } from '../components/RiskIndicator';
import type { IMarketToken } from '../MarketTokenData';

interface IUseMarketTokenListParams {
  networkId: string;
  sortBy?: string;
  sortType?: 'asc' | 'desc';
  pageSize?: number;
}

// 将 API 返回的数据转换为组件使用的格式
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
    liquidity: parseFloat(item.tvl || '0'), // 使用 TVL 作为流动性
    transactions: parseInt(item.trade24hCount || '0', 10),
    uniqueTraders: Math.floor(parseInt(item.trade24hCount || '0', 10) / 2), // 估算独特交易者数量
    holders: item.holders || 0,
    turnover: parseFloat(item.volume24h || '0'),
    tokenAge: '0Y', // API 中没有这个字段，暂时使用默认值
    audit: 'unknown' as IRiskIndicatorType, // API 中没有这个字段，暂时使用默认值
    tokenImageUri: item.logoUrl || '',
    networkLogoUri: '',
    walletInfo: undefined,
  }));
}

export function useMarketTokenList({
  networkId,
  sortBy,
  sortType,
  pageSize = 50,
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

  const hasNextPage = apiResult?.hasNext || false;

  // 分页数据（客户端分页，因为 API 已经返回了当前页的数据）
  const paginatedData = useMemo(() => {
    return transformedData;
  }, [transformedData]);

  const totalPages = useMemo(() => {
    if (!hasNextPage) return currentPage;
    return currentPage + 1; // 至少还有下一页
  }, [hasNextPage, currentPage]);

  return {
    data: paginatedData,
    isLoading,
    currentPage,
    totalPages,
    hasNextPage,
    setCurrentPage,
    refetch: fetchMarketTokenList,
  };
}
