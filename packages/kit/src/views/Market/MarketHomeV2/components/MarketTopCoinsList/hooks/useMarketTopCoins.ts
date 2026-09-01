import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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

export async function resolveMarketTopCoinNavigationTarget(
  item: IMarketAssetListItem,
) {
  const detail =
    await backgroundApiProxy.serviceMarket.fetchMarketAssetDetail({
      assetId: item.assetId,
      currency: 'usd',
    });
  const { asset, market, selectedVariant } = detail;
  const networkInfo = selectedVariant?.networkId
    ? networkUtils.getLocalNetworkInfo(selectedVariant.networkId)
    : undefined;
  const hasTokenIdentity = Boolean(
    selectedVariant?.isNative || selectedVariant?.tokenAddress,
  );
  if (!networkInfo || !hasTokenIdentity) {
    throw new OneKeyLocalError('Invalid market asset variant');
  }
  const decimals = selectedVariant.isNative ? networkInfo.decimals : undefined;

  return {
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
  };
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

  const handleItemPress = useCallback(
    async (item: IMarketAssetListItem) => {
      if (isNavigatingRef.current) {
        return;
      }
      isNavigatingRef.current = true;
      try {
        await toMarketDetailPage(
          await resolveMarketTopCoinNavigationTarget(item),
        );
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
    [intl, toMarketDetailPage],
  );

  return {
    data,
    handleItemPress,
    isLoading,
  };
}
