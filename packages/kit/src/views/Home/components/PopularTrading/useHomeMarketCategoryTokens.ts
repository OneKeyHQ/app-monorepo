import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { HOME_MARKET_CATEGORY_REQUEST_LIMIT } from './constants';
import { EMPTY_DISPLAY_TOKENS, mapMarketTokenToDisplay } from './utils';

import type { IFavoriteTokenDisplay } from './types';

const HOME_MARKET_CATEGORY_POLLING_INTERVAL = timerUtils.getTimeDurationMs({
  seconds: 30,
});

type ICategoryTokensResult = {
  requestKey: string;
  tokens: IFavoriteTokenDisplay[];
};

function getMarketCategoryTokensRequestKey({
  minLiquidity,
  selectedMarketCategoryId,
}: {
  minLiquidity: number;
  selectedMarketCategoryId?: string;
}) {
  return `${selectedMarketCategoryId ?? ''}:${minLiquidity}`;
}

function useHomeMarketCategoryTokens({
  minLiquidity,
  selectedMarketCategoryId,
}: {
  minLiquidity: number;
  selectedMarketCategoryId?: string;
}) {
  const requestKey = getMarketCategoryTokensRequestKey({
    minLiquidity,
    selectedMarketCategoryId,
  });

  const { result: categoryTokensResult } =
    usePromiseResult<ICategoryTokensResult>(
      async () => {
        const currentRequestKey = getMarketCategoryTokensRequestKey({
          minLiquidity,
          selectedMarketCategoryId,
        });

        if (!selectedMarketCategoryId) {
          return {
            requestKey: currentRequestKey,
            tokens: EMPTY_DISPLAY_TOKENS,
          };
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

        return {
          requestKey: currentRequestKey,
          tokens: response.list
            .map(mapMarketTokenToDisplay)
            .filter((item): item is IFavoriteTokenDisplay => item !== null)
            .slice(0, HOME_MARKET_CATEGORY_REQUEST_LIMIT),
        };
      },
      [minLiquidity, selectedMarketCategoryId],
      {
        pollingInterval: HOME_MARKET_CATEGORY_POLLING_INTERVAL,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        undefinedResultIfReRun: false,
      },
    );

  const hasCurrentCategoryTokens =
    categoryTokensResult?.requestKey === requestKey;
  const hasSelectedMarketCategory = Boolean(selectedMarketCategoryId);

  return {
    categoryTokens:
      hasCurrentCategoryTokens && categoryTokensResult
        ? categoryTokensResult.tokens
        : EMPTY_DISPLAY_TOKENS,
    isCategoryLoading: hasSelectedMarketCategory && !hasCurrentCategoryTokens,
  };
}

export { useHomeMarketCategoryTokens };
