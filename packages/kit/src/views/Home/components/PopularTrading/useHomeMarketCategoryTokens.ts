import { useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { HOME_MARKET_CATEGORY_REQUEST_LIMIT } from './constants';
import { EMPTY_DISPLAY_TOKENS, mapMarketTokenToDisplay } from './utils';

import type { IFavoriteTokenDisplay } from './types';

function useHomeMarketCategoryTokens({
  minLiquidity,
  selectedMarketCategoryId,
}: {
  minLiquidity: number;
  selectedMarketCategoryId?: string;
}) {
  const {
    result: categoryTokensResult,
    isLoading: isCategoryLoading,
    run: refreshCategoryTokens,
  } = usePromiseResult(
    async () => {
      if (!selectedMarketCategoryId) {
        return [];
      }

      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenList({
          networkId: '',
          sortBy: 'v24hUSD',
          sortType: 'desc',
          page: 1,
          limit: HOME_MARKET_CATEGORY_REQUEST_LIMIT,
          minLiquidity,
          type: selectedMarketCategoryId,
          timeFrame: '2',
        });

      return response.list
        .map(mapMarketTokenToDisplay)
        .filter((item): item is IFavoriteTokenDisplay => item !== null)
        .slice(0, HOME_MARKET_CATEGORY_REQUEST_LIMIT);
    },
    [minLiquidity, selectedMarketCategoryId],
    {
      initResult: [],
      watchLoading: true,
      pollingInterval: selectedMarketCategoryId
        ? timerUtils.getTimeDurationMs({ seconds: 30 })
        : undefined,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      undefinedResultIfReRun: true,
    },
  );

  useEffect(() => {
    if (selectedMarketCategoryId) {
      void refreshCategoryTokens();
    }
  }, [refreshCategoryTokens, selectedMarketCategoryId]);

  return {
    categoryTokens: categoryTokensResult ?? EMPTY_DISPLAY_TOKENS,
    isCategoryLoading,
  };
}

export { useHomeMarketCategoryTokens };
