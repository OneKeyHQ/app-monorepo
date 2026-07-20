import { useEffect, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { isMarketStockCategory } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/utils';
import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  buildStockSwapTokenFromMarketListToken,
  getMarketListTokenKey,
  shouldLoadDefaultStockToken,
} from './swapStockChannelUtils';

export function useSwapStockDefaultToken({
  selectStockSwapToken,
  selectedStockTokenKey,
  spotCategories,
}: {
  selectStockSwapToken: (token: ISwapToken) => void;
  selectedStockTokenKey: string;
  spotCategories: {
    type: string;
    name: string;
  }[];
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

  const shouldLoadDefaultStockTokenValue = shouldLoadDefaultStockToken({
    selectedStockTokenKey,
  });
  const defaultStockTokenScope = `${
    shouldLoadDefaultStockTokenValue ? '1' : '0'
  }:${stockCategoryType ?? ''}`;
  const {
    result: defaultStockTokenState,
    isLoading: defaultStockTokenLoading,
  } = usePromiseResult(
    async () => {
      if (!shouldLoadDefaultStockTokenValue || !stockCategoryType) {
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
          limit: 1,
        });
      return {
        scope: defaultStockTokenScope,
        token: response.list.find((item) => !!item.stock) ?? response.list[0],
      };
    },
    [
      defaultStockTokenScope,
      shouldLoadDefaultStockTokenValue,
      stockCategoryType,
    ],
    {
      initResult: {
        scope: '',
        token: undefined as IMarketTokenListItem | undefined,
      },
      watchLoading: shouldLoadDefaultStockTokenValue,
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
      !shouldLoadDefaultStockTokenValue ||
      !defaultStockToken ||
      !defaultStockTokenKey ||
      !defaultStockNetworkId
    ) {
      return;
    }
    const nextSwapToken =
      buildStockSwapTokenFromMarketListToken(defaultStockToken);
    if (nextSwapToken) {
      selectStockSwapToken(nextSwapToken);
    }
  }, [
    defaultStockToken,
    defaultStockTokenKey,
    selectStockSwapToken,
    shouldLoadDefaultStockTokenValue,
  ]);

  return {
    defaultStockTokenLoading: !!defaultStockTokenLoading,
    shouldLoadDefaultStockToken: shouldLoadDefaultStockTokenValue,
    stockCategoryType,
  };
}
