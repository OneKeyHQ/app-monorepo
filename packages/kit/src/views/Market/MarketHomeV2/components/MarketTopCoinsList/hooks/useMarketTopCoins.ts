import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';

import { useToDetailPage } from '../../MarketTokenList/hooks/useToMarketDetailPage';

const EMPTY_MARKET_ASSET_LIST: IMarketAssetListItem[] = [];

function toFiniteNumber(value: string) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

export function useMarketTopCoins() {
  const intl = useIntl();
  const toMarketDetailPage = useToDetailPage({
    marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
  });
  const isNavigatingRef = useRef(false);

  const { result, isLoading } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceMarket.fetchMarketAssetList({
        currency: 'usd',
        limit: 100,
        page: 1,
        type: MARKET_TOP_COINS_CATEGORY_ID,
      }),
    [],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 50 }),
      revalidateOnReconnect: true,
      watchLoading: true,
    },
  );
  const data = result?.list ?? EMPTY_MARKET_ASSET_LIST;

  const navigateToFallbackDetail = useCallback(
    async (item: IMarketAssetListItem) => {
      await toMarketDetailPage({
        address: item.assetId,
        change24h: toFiniteNumber(item.priceChange24hPercent),
        decimals: 0,
        disableTrade: true,
        marketCap: toFiniteNumber(item.marketCap),
        name: item.symbol.toUpperCase(),
        networkId: 'coingecko',
        price: toFiniteNumber(item.price),
        showFavoriteButton: false,
        skipMarketDataFetch: true,
        symbol: item.symbol.toUpperCase(),
        tokenAddress: item.assetId,
        tokenImageUri: item.logoUrl,
        turnover: toFiniteNumber(item.volume24h),
      });
    },
    [toMarketDetailPage],
  );

  const handleItemPress = useCallback(
    async (item: IMarketAssetListItem) => {
      if (isNavigatingRef.current) {
        return;
      }
      isNavigatingRef.current = true;
      try {
        let detail: Awaited<
          ReturnType<
            typeof backgroundApiProxy.serviceMarket.fetchMarketAssetDetail
          >
        >;
        try {
          detail =
            await backgroundApiProxy.serviceMarket.fetchMarketAssetDetail({
              assetId: item.assetId,
              currency: 'usd',
            });
        } catch (_error) {
          await navigateToFallbackDetail(item);
          return;
        }
        const { asset, market, selectedVariant } = detail;
        if (!selectedVariant?.networkId) {
          await navigateToFallbackDetail(item);
          return;
        }
        const decimals = selectedVariant.isNative
          ? networkUtils.getLocalNetworkInfo(selectedVariant.networkId)
              ?.decimals
          : undefined;
        await toMarketDetailPage({
          address: selectedVariant.tokenAddress,
          change24h: toFiniteNumber(market.priceChange24hPercent),
          ...(typeof decimals === 'number' ? { decimals } : undefined),
          isNative: selectedVariant.isNative,
          marketCap: toFiniteNumber(market.marketCap),
          marketTokenId: asset.assetId,
          name: asset.name,
          networkId: selectedVariant.networkId,
          price: toFiniteNumber(market.price),
          symbol: asset.symbol.toUpperCase(),
          tokenAddress: selectedVariant.tokenAddress,
          tokenImageUri: asset.logoUrl,
          turnover: toFiniteNumber(market.volume24h),
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
