import { useCallback, useEffect, useState } from 'react';

import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export function useMarketDetailData(coinGeckoId: string) {
  const [tokenDetail, setTokenDetail] = useState<
    IMarketTokenDetail | undefined
  >(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMarketTokenDetail = useCallback(async () => {
    const response =
      await backgroundApiProxy.serviceMarket.fetchMarketTokenDetail(
        coinGeckoId,
      );
    setTokenDetail(response);
  }, [coinGeckoId]);

  useEffect(() => {
    void fetchMarketTokenDetail();
  }, [fetchMarketTokenDetail]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchMarketTokenDetail();
    setIsRefreshing(false);
  }, [fetchMarketTokenDetail]);

  return {
    tokenDetail,
    fetchMarketTokenDetail,
    isRefreshing,
    onRefresh,
  };
}
