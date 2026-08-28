import { useCallback, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getLegacyMarketNavigationTarget } from '@onekeyhq/kit/src/views/Market/utils/legacyMarketNetwork';
import {
  MARKET_TOP_COINS_CATEGORY_ID,
  MARKET_TOP_COINS_LEGACY_CATEGORY_ID,
} from '@onekeyhq/shared/src/consts/marketConsts';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketToken } from '@onekeyhq/shared/types/market';

import { useToDetailPage } from '../../MarketTokenList/hooks/useToMarketDetailPage';

export function useMarketTopCoins() {
  const toMarketDetailPage = useToDetailPage({
    marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
  });
  const isNavigatingRef = useRef(false);

  const { result: data = [], isLoading } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceMarket.fetchCategory(
        MARKET_TOP_COINS_LEGACY_CATEGORY_ID,
        [],
        true,
      ),
    [],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 50 }),
      revalidateOnReconnect: true,
    },
  );

  const handleItemPress = useCallback(
    async (item: IMarketToken) => {
      if (isNavigatingRef.current) {
        return;
      }
      isNavigatingRef.current = true;
      try {
        const detail =
          await backgroundApiProxy.serviceMarket.fetchMarketTokenDetail(
            item.coingeckoId,
          );
        const target = getLegacyMarketNavigationTarget(detail);
        if (!target) {
          await toMarketDetailPage({
            address: item.coingeckoId,
            change24h: item.priceChangePercentage24H,
            decimals: 0,
            disableTrade: true,
            marketCap: item.marketCap,
            marketTokenId: item.coingeckoId,
            name: item.name,
            networkId: 'coingecko',
            price: item.price,
            showFavoriteButton: false,
            skipMarketDataFetch: true,
            symbol: item.symbol.toUpperCase(),
            tokenAddress: item.coingeckoId,
            tokenImageUri: item.image || item.iconUrl,
            turnover: item.totalVolume,
          });
          return;
        }
        await toMarketDetailPage({
          ...target,
          address: target.tokenAddress,
          change24h: item.priceChangePercentage24H,
          marketCap: item.marketCap,
          marketTokenId: item.coingeckoId,
          name: item.name,
          price: item.price,
          symbol: item.symbol.toUpperCase(),
          tokenImageUri: item.image || item.iconUrl,
          turnover: item.totalVolume,
        });
      } finally {
        isNavigatingRef.current = false;
      }
    },
    [toMarketDetailPage],
  );

  return {
    data,
    handleItemPress,
    isLoading,
  };
}
