import { useEffect, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { isMarketStockCategory } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/utils';
import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  buildStockSwapTokenFromMarketListToken,
  getMarketListTokenKey,
} from './swapStockChannelUtils';

const DEFAULT_STOCK_TOKEN_CANDIDATE_LIMIT = 50;
const DEFAULT_STOCK_TOKEN_MAX_PAGES = 5;

export function useSwapStockDefaultToken({
  marketPresetTokenKey,
  marketStockToken,
  selectStockSwapToken,
  selectedStockTokenKey,
  spotCategories,
  tokenDetailHasStock,
}: {
  marketPresetTokenKey: string;
  marketStockToken?: ISwapToken;
  selectStockSwapToken: (token: ISwapToken) => void;
  selectedStockTokenKey: string;
  spotCategories: {
    type: string;
    name: string;
  }[];
  tokenDetailHasStock: boolean;
}) {
  const stockCategoryType = useMemo(() => {
    const stockCategory = spotCategories.find((category) =>
      isMarketStockCategory({
        id: category.type,
        name: category.name,
      }),
    );
    return stockCategory?.type;
  }, [spotCategories]);

  const shouldLoadDefaultStockToken =
    !selectedStockTokenKey && !marketPresetTokenKey && !marketStockToken;
  const defaultStockTokenScope = `${
    shouldLoadDefaultStockToken ? '1' : '0'
  }:${stockCategoryType ?? ''}`;
  const {
    result: defaultStockTokenState,
    isLoading: defaultStockTokenLoading,
  } = usePromiseResult(
    async () => {
      if (!shouldLoadDefaultStockToken || !stockCategoryType) {
        return {
          scope: defaultStockTokenScope,
          token: undefined as IMarketTokenListItem | undefined,
        };
      }
      let nextPage = 1;
      let loadedCount = 0;

      while (nextPage <= DEFAULT_STOCK_TOKEN_MAX_PAGES) {
        const response =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenList({
            networkId: '',
            type: stockCategoryType,
            sortBy: 'v24hUSD',
            sortType: 'desc',
            page: nextPage,
            limit: DEFAULT_STOCK_TOKEN_CANDIDATE_LIMIT,
          });
        const token = response.list.find((item) => !!item.stock);
        if (token) {
          return {
            scope: defaultStockTokenScope,
            token,
          };
        }
        loadedCount += response.list.length;
        const hasKnownTotal =
          Number.isFinite(response.total) && response.total > 0;
        if (
          response.list.length < DEFAULT_STOCK_TOKEN_CANDIDATE_LIMIT ||
          (hasKnownTotal && loadedCount >= response.total)
        ) {
          break;
        }
        nextPage += 1;
      }

      return {
        scope: defaultStockTokenScope,
        token: undefined,
      };
    },
    [defaultStockTokenScope, shouldLoadDefaultStockToken, stockCategoryType],
    {
      initResult: {
        scope: '',
        token: undefined as IMarketTokenListItem | undefined,
      },
      watchLoading: shouldLoadDefaultStockToken,
    },
  );

  const defaultStockToken =
    defaultStockTokenState.scope === defaultStockTokenScope
      ? defaultStockTokenState.token
      : undefined;
  const defaultStockTokenKey = getMarketListTokenKey(defaultStockToken);

  useEffect(() => {
    const defaultStockNetworkId =
      defaultStockToken?.networkId ?? defaultStockToken?.chainId;
    if (
      !shouldLoadDefaultStockToken ||
      !defaultStockToken ||
      !defaultStockTokenKey ||
      !defaultStockNetworkId
    ) {
      return;
    }
    const nextSwapToken =
      buildStockSwapTokenFromMarketListToken(defaultStockToken);
    if (nextSwapToken?.isStock) {
      selectStockSwapToken(nextSwapToken);
    }
  }, [
    defaultStockToken,
    defaultStockTokenKey,
    selectStockSwapToken,
    shouldLoadDefaultStockToken,
  ]);

  useEffect(() => {
    if (selectedStockTokenKey || !marketStockToken || !tokenDetailHasStock) {
      return;
    }
    selectStockSwapToken(marketStockToken);
  }, [
    marketStockToken,
    selectStockSwapToken,
    selectedStockTokenKey,
    tokenDetailHasStock,
  ]);

  return {
    defaultStockTokenLoading: !!defaultStockTokenLoading,
    shouldLoadDefaultStockToken,
    stockCategoryType,
  };
}
