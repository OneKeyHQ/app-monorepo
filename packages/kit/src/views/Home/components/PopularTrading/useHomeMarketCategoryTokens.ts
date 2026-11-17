import { useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import { getTokenSubtitle } from '@onekeyhq/shared/src/utils/perpsUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { isMarketStockCategoryById } from '../../../Market/MarketHomeV2/utils';

import {
  HOME_MARKET_CATEGORY_REQUEST_LIMIT,
  HOME_PERPS_HOT_CATEGORY_ID,
  HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
} from './constants';
import {
  EMPTY_DISPLAY_TOKENS,
  mapMarketAssetToDisplay,
  mapMarketPerpsTokenToDisplay,
  mapMarketStockToDisplay,
  mapMarketTokenToDisplay,
} from './utils';

import type { IFavoriteTokenDisplay } from './types';
import type {
  IMarketApiTimeFrame,
  IMarketCategoryItem,
} from '../../../Market/MarketHomeV2/types';

const EMPTY_HOME_MARKET_CATEGORIES: IMarketCategoryItem[] = [];

const HOME_MARKET_CATEGORY_POLLING_INTERVAL = timerUtils.getTimeDurationMs({
  seconds: 30,
});
const HOME_MARKET_CATEGORY_TIME_FRAME: IMarketApiTimeFrame = '4';

type ICategoryTokensResult = {
  requestKey: string;
  tokens: IFavoriteTokenDisplay[];
};

function getMarketCategoryTokensRequestKey({
  minLiquidity,
  selectedMarketCategoryId,
  locale,
}: {
  minLiquidity: number;
  selectedMarketCategoryId?: string;
  locale: string;
}) {
  return `${selectedMarketCategoryId ?? ''}:${minLiquidity}:${locale}`;
}

function useHomeMarketCategoryTokens({
  minLiquidity,
  selectedMarketCategoryId,
  marketCategories = EMPTY_HOME_MARKET_CATEGORIES,
}: {
  minLiquidity: number;
  selectedMarketCategoryId?: string;
  marketCategories?: IMarketCategoryItem[];
}) {
  const locale = useLocaleVariant();
  const categoryCacheRef = useRef(new Map<string, ICategoryTokensResult>());
  const requestKey = getMarketCategoryTokensRequestKey({
    minLiquidity,
    selectedMarketCategoryId,
    locale,
  });

  const { result: categoryTokensResult } =
    usePromiseResult<ICategoryTokensResult>(
      async () => {
        const currentRequestKey = getMarketCategoryTokensRequestKey({
          minLiquidity,
          selectedMarketCategoryId,
          locale,
        });

        if (!selectedMarketCategoryId) {
          return {
            requestKey: currentRequestKey,
            tokens: EMPTY_DISPLAY_TOKENS,
          };
        }

        if (selectedMarketCategoryId === HOME_PERPS_HOT_CATEGORY_ID) {
          const [response, tokenSearchAliases] = await Promise.all([
            backgroundApiProxy.serviceMarketV2.fetchMarketPerpsTokenList({
              category: HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
            }),
            backgroundApiProxy.serviceHyperliquid.getTokenSearchAliases(),
          ]);

          return {
            requestKey: currentRequestKey,
            tokens: response.tokens
              .map((token) =>
                mapMarketPerpsTokenToDisplay({
                  token,
                  subtitle: getTokenSubtitle(token.name, tokenSearchAliases),
                }),
              )
              .slice(0, HOME_MARKET_CATEGORY_REQUEST_LIMIT),
          };
        }

        if (selectedMarketCategoryId === MARKET_TOP_COINS_CATEGORY_ID) {
          const response =
            await backgroundApiProxy.serviceMarket.fetchMarketAssetList({
              currency: 'usd',
              limit: HOME_MARKET_CATEGORY_REQUEST_LIMIT,
              page: 1,
              type: MARKET_TOP_COINS_CATEGORY_ID,
            });

          return {
            requestKey: currentRequestKey,
            tokens: response.list.map(mapMarketAssetToDisplay),
          };
        }

        if (
          isMarketStockCategoryById(marketCategories, selectedMarketCategoryId)
        ) {
          const response =
            await backgroundApiProxy.serviceMarketV2.fetchMarketStockList({
              limit: HOME_MARKET_CATEGORY_REQUEST_LIMIT,
            });

          return {
            requestKey: currentRequestKey,
            tokens: response.items
              .map(mapMarketStockToDisplay)
              .slice(0, HOME_MARKET_CATEGORY_REQUEST_LIMIT),
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
            timeFrame: HOME_MARKET_CATEGORY_TIME_FRAME,
          });

        return {
          requestKey: currentRequestKey,
          tokens: response.list
            .map(mapMarketTokenToDisplay)
            .filter((item): item is IFavoriteTokenDisplay => item !== null)
            .slice(0, HOME_MARKET_CATEGORY_REQUEST_LIMIT),
        };
      },
      [marketCategories, minLiquidity, selectedMarketCategoryId, locale],
      {
        pollingInterval: HOME_MARKET_CATEGORY_POLLING_INTERVAL,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        undefinedResultIfReRun: false,
        // Home keeps its state when React reconnects effects after an update.
        resumeOnEffectReconnect: true,
      },
    );

  useEffect(() => {
    if (categoryTokensResult) {
      categoryCacheRef.current.set(
        categoryTokensResult.requestKey,
        categoryTokensResult,
      );
    }
  }, [categoryTokensResult]);

  // Returning to a category keeps its rows visible while the next request runs.
  const currentCategoryResult =
    categoryTokensResult?.requestKey === requestKey
      ? categoryTokensResult
      : categoryCacheRef.current.get(requestKey);
  const hasSelectedMarketCategory = Boolean(selectedMarketCategoryId);

  return {
    categoryTokens: currentCategoryResult
      ? currentCategoryResult.tokens
      : EMPTY_DISPLAY_TOKENS,
    isCategoryLoading: hasSelectedMarketCategory && !currentCategoryResult,
  };
}

export { useHomeMarketCategoryTokens };
