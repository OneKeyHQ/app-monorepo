import { useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getTokenSubtitle } from '@onekeyhq/shared/src/utils/perpsUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import {
  HOME_MARKET_CATEGORY_REQUEST_LIMIT,
  HOME_PERPS_HOT_CATEGORY_ID,
  HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
} from './constants';
import {
  EMPTY_DISPLAY_TOKENS,
  getMarketCategoryIds,
  mapMarketPerpsTokenToDisplay,
  mapMarketTokenToDisplay,
} from './utils';

import type { IFavoriteTokenDisplay } from './types';
import type { IMarketApiTimeFrame } from '../../../Market/MarketHomeV2/types';

const HOME_MARKET_CATEGORY_POLLING_INTERVAL = timerUtils.getTimeDurationMs({
  seconds: 30,
});
const HOME_MARKET_CATEGORY_TIME_FRAME: IMarketApiTimeFrame = '4';

type ICategoryTokensResult = {
  requestKey: string;
  tokensByRequestKey: Record<string, IFavoriteTokenDisplay[]>;
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

async function fetchHomeMarketCategoryTokens({
  categoryId,
  minLiquidity,
}: {
  categoryId: string;
  minLiquidity: number;
}) {
  if (categoryId === HOME_PERPS_HOT_CATEGORY_ID) {
    const [response, tokenSearchAliases] = await Promise.all([
      backgroundApiProxy.serviceMarketV2.fetchMarketPerpsTokenList({
        category: HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
      }),
      backgroundApiProxy.serviceHyperliquid.getTokenSearchAliases(),
    ]);

    return response.tokens
      .map((token) =>
        mapMarketPerpsTokenToDisplay({
          token,
          subtitle: getTokenSubtitle(token.name, tokenSearchAliases),
        }),
      )
      .slice(0, HOME_MARKET_CATEGORY_REQUEST_LIMIT);
  }

  const response =
    await backgroundApiProxy.serviceMarketV2.fetchMarketTokenList({
      networkId: '',
      sortBy: 'v24hUSD',
      sortType: 'desc',
      page: 1,
      limit: HOME_MARKET_CATEGORY_REQUEST_LIMIT,
      minLiquidity,
      type: categoryId,
      timeFrame: HOME_MARKET_CATEGORY_TIME_FRAME,
    });

  return response.list
    .map(mapMarketTokenToDisplay)
    .filter((item): item is IFavoriteTokenDisplay => item !== null)
    .slice(0, HOME_MARKET_CATEGORY_REQUEST_LIMIT);
}

function useHomeMarketCategoryTokens({
  minLiquidity,
  prefetchMarketCategoryIds,
  selectedMarketCategoryId,
}: {
  minLiquidity: number;
  prefetchMarketCategoryIds?: string[];
  selectedMarketCategoryId?: string;
}) {
  const categoryIdsKey = getMarketCategoryIds({
    prefetchMarketCategoryIds,
    selectedMarketCategoryId,
  }).join('|');
  const categoryIds = useMemo(
    () => (categoryIdsKey ? categoryIdsKey.split('|') : []),
    [categoryIdsKey],
  );
  const categoryRequestKeys = categoryIds.map((categoryId) =>
    getMarketCategoryTokensRequestKey({
      minLiquidity,
      selectedMarketCategoryId: categoryId,
    }),
  );
  const requestKey = categoryRequestKeys.join('|');
  const selectedRequestKey = getMarketCategoryTokensRequestKey({
    minLiquidity,
    selectedMarketCategoryId,
  });
  const tokensByRequestKeyRef = useRef<Record<string, IFavoriteTokenDisplay[]>>(
    {},
  );

  const { result: categoryTokensResult, run: refresh } =
    usePromiseResult<ICategoryTokensResult>(
      async () => {
        const settledResults = await Promise.allSettled(
          categoryIds.map(async (categoryId) => ({
            categoryId,
            tokens: await fetchHomeMarketCategoryTokens({
              categoryId,
              minLiquidity,
            }),
          })),
        );
        const tokensByRequestKey = { ...tokensByRequestKeyRef.current };
        settledResults.forEach((result) => {
          if (result.status !== 'fulfilled') {
            return;
          }
          tokensByRequestKey[
            getMarketCategoryTokensRequestKey({
              minLiquidity,
              selectedMarketCategoryId: result.value.categoryId,
            })
          ] = result.value.tokens;
        });
        tokensByRequestKeyRef.current = tokensByRequestKey;

        return {
          requestKey,
          tokensByRequestKey,
        };
      },
      [categoryIds, minLiquidity, requestKey],
      {
        initResult: {
          requestKey: 'initial',
          tokensByRequestKey: {},
        },
        pollingInterval: HOME_MARKET_CATEGORY_POLLING_INTERVAL,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        undefinedResultIfReRun: false,
      },
    );

  const hasSelectedMarketCategory = Boolean(selectedMarketCategoryId);
  const selectedCategoryTokens =
    categoryTokensResult.tokensByRequestKey[selectedRequestKey] ??
    tokensByRequestKeyRef.current[selectedRequestKey];

  return {
    categoryTokens: selectedCategoryTokens ?? EMPTY_DISPLAY_TOKENS,
    isCategoryLoading:
      hasSelectedMarketCategory && selectedCategoryTokens === undefined,
    refresh,
  };
}

export { useHomeMarketCategoryTokens };
