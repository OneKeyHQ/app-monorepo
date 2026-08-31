import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getLegacyMarketNavigationTarget } from '@onekeyhq/kit/src/views/Market/utils/legacyMarketNetwork';
import {
  MARKET_TOP_COINS_CATEGORY_ID,
  MARKET_TOP_COINS_LEGACY_CATEGORY_ID,
} from '@onekeyhq/shared/src/consts/marketConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketToken } from '@onekeyhq/shared/types/market';

import { useToDetailPage } from '../../MarketTokenList/hooks/useToMarketDetailPage';

export function useMarketTopCoins() {
  const intl = useIntl();
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
      watchLoading: true,
    },
  );

  const navigateToFallbackDetail = useCallback(
    async (item: IMarketToken) => {
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
    },
    [toMarketDetailPage],
  );

  const handleItemPress = useCallback(
    async (item: IMarketToken) => {
      if (isNavigatingRef.current) {
        return;
      }
      isNavigatingRef.current = true;
      try {
        let target: ReturnType<typeof getLegacyMarketNavigationTarget>;
        try {
          const detail =
            await backgroundApiProxy.serviceMarket.fetchMarketTokenDetail(
              item.coingeckoId,
            );
          target = getLegacyMarketNavigationTarget(detail);
        } catch (_error) {
          await navigateToFallbackDetail(item);
          return;
        }
        if (!target) {
          await navigateToFallbackDetail(item);
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
      } catch (_error) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          }),
        });
      } finally {
        isNavigatingRef.current = false;
      }
    },
    [intl, navigateToFallbackDetail, toMarketDetailPage],
  );

  return {
    data,
    handleItemPress,
    isLoading,
  };
}
