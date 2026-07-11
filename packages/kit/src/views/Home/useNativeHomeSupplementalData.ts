import { useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IMarketPerpsTokenFromServer,
  IMarketTokenListItem,
} from '@onekeyhq/shared/types/marketV2';
import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

const DEFERRED_FETCH_DELAY_MS = 1200;
const REFRESH_INTERVAL = timerUtils.getTimeDurationMs({ seconds: 30 });

export function useNativeHomeSupplementalData() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setEnabled(true), DEFERRED_FETCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const market = usePromiseResult<IMarketTokenListItem[]>(
    async () => {
      if (!enabled) return [];
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenList({
          networkId: '',
          sortBy: 'v24hUSD',
          sortType: 'desc',
          page: 1,
          limit: 3,
          minLiquidity: 0,
          type: 'trending',
          timeFrame: '4',
        });
      return response.list.slice(0, 3);
    },
    [enabled],
    {
      initResult: [],
      pollingInterval: REFRESH_INTERVAL,
      revalidateOnFocus: true,
      undefinedResultIfReRun: false,
    },
  );

  const earn = usePromiseResult<IRecommendAsset[]>(
    async () => {
      if (!enabled) return [];
      const response =
        await backgroundApiProxy.serviceStaking.fetchAllNetworkAssetsV2();
      return response?.tokens?.slice(0, 6) ?? [];
    },
    [enabled],
    {
      initResult: [],
      revalidateOnFocus: true,
      undefinedResultIfReRun: false,
    },
  );

  const perpsMarket = usePromiseResult<IMarketPerpsTokenFromServer[]>(
    async () => {
      if (!enabled) return [];
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketPerpsTokenList({
          category: 'hot',
        });
      return response.tokens.slice(0, 5);
    },
    [enabled],
    {
      initResult: [],
      pollingInterval: REFRESH_INTERVAL,
      revalidateOnFocus: true,
      undefinedResultIfReRun: false,
    },
  );

  return {
    earn: earn.result ?? [],
    market: market.result ?? [],
    perpsMarket: perpsMarket.result ?? [],
    refresh: async () => {
      await Promise.all([market.run(), earn.run(), perpsMarket.run()]);
    },
  };
}
