import { useEffect, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';

import type { IMarketToken } from '../MarketTokenData';

interface IUseMarketTokenListParams {
  networkId: string;
  sortBy?: string;
  sortType?: 'asc' | 'desc';
  pageSize?: number;
}

function getNetworkLogoUri(networkId: string): string {
  const networks = getPresetNetworks();
  const network = networks.find((n) => n.id === networkId);
  return network?.logoURI || '';
}

function transformApiDataToComponentData(
  apiData: IMarketTokenListItem[],
  networkLogoUri: string,
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
    networkLogoUri,
    walletInfo: {
      buy: parseInt(item.buy24hCount || '0', 10),
      sell: parseInt(item.sell24hCount || '0', 10),
    },
  }));
}

export function useMarketTokenList({
  networkId,
  sortBy,
  sortType,
  pageSize = 10,
}: IUseMarketTokenListParams) {
  const [currentPage, setCurrentPage] = useState(1);
  const [transformedData, setTransformedData] = useState<IMarketToken[]>([]);

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

  useEffect(() => {
    if (!apiResult || !apiResult.list || apiResult.list.length <= 0) {
      return;
    }

    const networkLogoUri = getNetworkLogoUri(networkId);
    const transformed = transformApiDataToComponentData(
      apiResult.list,
      networkLogoUri,
    );
    setTransformedData(transformed);
  }, [apiResult, networkId]);

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
