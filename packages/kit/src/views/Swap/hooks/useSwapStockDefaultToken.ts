import { useEffect, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { isMarketStockCategory } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/utils';
import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';
import type {
  IMarketPresetTokenContext,
  ISwapToken,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';

import {
  buildStockSwapTokenFromMarketListToken,
  getMarketListTokenKey,
} from './swapStockChannelUtils';

export function useSwapStockDefaultToken({
  marketPresetToken,
  marketPresetTokenKey,
  marketStockToken,
  requestMarketActiveToken,
  selectStockSwapToken,
  selectedStockTokenKey,
  spotCategories,
  tokenDetailHasStock,
}: {
  marketPresetToken?: IMarketPresetTokenContext;
  marketPresetTokenKey: string;
  marketStockToken?: ISwapToken;
  requestMarketActiveToken: (token?: Partial<ISwapTokenBase>) => void;
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

  useEffect(() => {
    if (
      selectedStockTokenKey ||
      !marketPresetTokenKey ||
      !marketPresetToken?.networkId
    ) {
      return;
    }
    requestMarketActiveToken(marketPresetToken);
  }, [
    marketPresetToken,
    marketPresetTokenKey,
    requestMarketActiveToken,
    selectedStockTokenKey,
  ]);

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
          limit: 1,
        });
      return {
        scope: defaultStockTokenScope,
        token: response.list.find((item) => !!item.stock) ?? response.list[0],
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
    requestMarketActiveToken({
      contractAddress: defaultStockToken.address,
      networkId: defaultStockNetworkId,
      isNative: defaultStockToken.isNative,
    });
    const nextSwapToken =
      buildStockSwapTokenFromMarketListToken(defaultStockToken);
    if (nextSwapToken) {
      selectStockSwapToken(nextSwapToken);
    }
  }, [
    defaultStockToken,
    defaultStockTokenKey,
    requestMarketActiveToken,
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
