import { useMemo, useReducer, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
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
  createHomeMarketCategoryTokensCache,
  getMarketCategoryIds,
  getMarketCategoryTokensRequestKey,
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
  const tokensCacheRef = useRef(
    createHomeMarketCategoryTokensCache<IFavoriteTokenDisplay>(),
  );
  const isMountedRef = useIsMounted();
  const [, renderCommittedCategory] = useReducer((version: number) => {
    return version + 1;
  }, 0);

  const { result: categoryTokensResult, run: refresh } =
    usePromiseResult<ICategoryTokensResult>(
      async () => {
        const requestId = tokensCacheRef.current.beginRequest({
          categoryIds,
          minLiquidity,
        });
        await Promise.allSettled(
          categoryIds.map(async (categoryId) => {
            const tokens = await fetchHomeMarketCategoryTokens({
              categoryId,
              minLiquidity,
            });
            const didCommit = tokensCacheRef.current.commitCategory({
              categoryId,
              minLiquidity,
              requestId,
              tokens,
            });
            if (didCommit && isMountedRef.current) {
              renderCommittedCategory();
            }
            return { categoryId, tokens };
          }),
        );

        return {
          requestKey,
          tokensByRequestKey: tokensCacheRef.current.getSnapshot(),
        };
      },
      [categoryIds, isMountedRef, minLiquidity, requestKey],
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
    tokensCacheRef.current.getTokens({
      minLiquidity,
      selectedMarketCategoryId,
    }) ?? categoryTokensResult.tokensByRequestKey[selectedRequestKey];

  return {
    categoryTokens: selectedCategoryTokens ?? EMPTY_DISPLAY_TOKENS,
    isCategoryLoading:
      hasSelectedMarketCategory && selectedCategoryTokens === undefined,
    requestKey,
    selectedRequestKey,
    tokensByRequestKey: tokensCacheRef.current.getSnapshot(),
    refresh,
  };
}

export { useHomeMarketCategoryTokens };
