import { useEffect, useMemo, useState } from 'react';

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
  sortBy?: string;
  sortType?: 'asc' | 'desc';
  pageSize?: number;
  minLiquidity?: number;
  maxLiquidity?: number;
}

export function useMarketTokenList({
  networkId,
  sortBy,
  sortType,
  pageSize = 20,
  minLiquidity,
  maxLiquidity,
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
          minLiquidity,
          maxLiquidity,
        });
      return response;
    },
    [
      networkId,
      sortBy,
      sortType,
      currentPage,
      pageSize,
      minLiquidity,
      maxLiquidity,
    ],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 5 }),
    },
  );

  useEffect(() => {
    if (!apiResult || !apiResult.list || apiResult.list.length <= 0) {
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
    setTransformedData(transformed);
  }, [apiResult, networkId]);

  const totalCount = apiResult?.total || 0;

  const totalPages = useMemo(() => {
    return totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1;
  }, [totalCount, pageSize]);

  return {
    data: transformedData,
    isLoading,
    currentPage,
    totalPages,
    totalCount,
    setCurrentPage,
    refetch: fetchMarketTokenList,
  };
}
