import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';

import { useToDetailPage } from '../../MarketTokenList/hooks/useToMarketDetailPage';

const EMPTY_MARKET_ASSET_LIST: IMarketAssetListItem[] = [];

function toFiniteNumber(value: string) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

type IUseMarketTopCoinNavigationOptions = {
  replaceCurrentDetail?: boolean;
};

export async function resolveMarketTopCoinNavigationTarget(
  item: Pick<IMarketAssetListItem, 'assetId'>,
) {
  const detail = await backgroundApiProxy.serviceMarket.fetchMarketAssetDetail({
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
  let decimals: number | undefined;
  if (selectedVariant.isNative) {
    decimals = networkInfo.decimals;
  } else {
    try {
      const tokenInfo =
        await backgroundApiProxy.serviceToken.fetchTokenInfoOnly({
          networkId: selectedVariant.networkId,
          tokenAddress: selectedVariant.tokenAddress,
        });
      decimals = tokenInfo?.info?.decimals;
    } catch {
      decimals = undefined;
    }
  }
  if (
    typeof decimals !== 'number' ||
    !Number.isFinite(decimals) ||
    !Number.isInteger(decimals) ||
    decimals < 0
  ) {
    decimals = undefined;
  }
  return {
    address: selectedVariant.tokenAddress,
    change24h: toFiniteNumber(market.priceChange24hPercent),
    decimals,
    isNative: selectedVariant.isNative,
    marketCap: toFiniteNumber(market.marketCap),
    marketTokenId: asset.assetId,
    marketVariantId: selectedVariant.variantId,
    name: asset.name,
    networkId: selectedVariant.networkId,
    price: toFiniteNumber(market.price),
    symbol: asset.symbol.toUpperCase(),
    tokenAddress: selectedVariant.tokenAddress,
    tokenImageUri: asset.logoUrl,
    turnover: toFiniteNumber(market.volume24h),
  };
}

export function useMarketTopCoinResolver() {
  const intl = useIntl();
  const isNavigatingRef = useRef(false);

  return useCallback(
    async (item: IMarketAssetListItem) => {
      if (isNavigatingRef.current) {
        return undefined;
      }
      isNavigatingRef.current = true;
      try {
        return await resolveMarketTopCoinNavigationTarget(item);
      } catch (_error) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          }),
        });
        return undefined;
      } finally {
        isNavigatingRef.current = false;
      }
    },
    [intl],
  );
}

export function useMarketTopCoinNavigation({
  replaceCurrentDetail = false,
}: IUseMarketTopCoinNavigationOptions = {}) {
  const intl = useIntl();
  const resolveMarketTopCoin = useMarketTopCoinResolver();
  const toMarketDetailPage = useToDetailPage({
    marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
    replaceCurrentDetail,
  });
  const isNavigatingRef = useRef(false);

  const handleItemPress = useCallback(
    async (item: IMarketAssetListItem) => {
      if (isNavigatingRef.current) {
        return;
      }
      isNavigatingRef.current = true;
      try {
        const token = await resolveMarketTopCoin(item);
        if (token) {
          await toMarketDetailPage(token);
        }
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
    [intl, resolveMarketTopCoin, toMarketDetailPage],
  );

  return handleItemPress;
}

export function useMarketTopCoins(
  options: IUseMarketTopCoinNavigationOptions & {
    dataCacheRef?: RefObject<IMarketAssetListItem[] | undefined>;
  } = {},
) {
  const handleItemPress = useMarketTopCoinNavigation(options);
  const {
    result,
    isLoading,
    run: refresh,
  } = usePromiseResult(
    async () => {
      try {
        const response =
          await backgroundApiProxy.serviceMarket.fetchMarketAssetList({
            currency: 'usd',
            limit: 100,
            page: 1,
            type: MARKET_TOP_COINS_CATEGORY_ID,
          });
        return { response, failed: false };
      } catch (error) {
        if (!platformEnv.isNative) throw error;
        return { response: undefined, failed: true };
      }
    },
    [],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 50 }),
      revalidateOnReconnect: true,
      watchLoading: true,
    },
  );
  const localDataCacheRef = useRef<IMarketAssetListItem[] | undefined>(
    undefined,
  );
  const dataCacheRef = options.dataCacheRef ?? localDataCacheRef;
  useEffect(() => {
    if (result?.response) dataCacheRef.current = result.response.list;
  }, [dataCacheRef, result]);
  const data =
    result?.response?.list ?? dataCacheRef.current ?? EMPTY_MARKET_ASSET_LIST;

  return {
    data,
    handleItemPress,
    isLoading,
    isError: Boolean(result?.failed),
    refresh,
  };
}
