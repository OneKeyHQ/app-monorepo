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
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenList({
          networkId: '',
          type: stockCategoryType,
          sortBy: 'v24hUSD',
          sortType: 'desc',
          page: 1,
          limit: DEFAULT_STOCK_TOKEN_CANDIDATE_LIMIT,
        });
      return {
        scope: defaultStockTokenScope,
        token: response.list.find((item) => !!item.stock),
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
