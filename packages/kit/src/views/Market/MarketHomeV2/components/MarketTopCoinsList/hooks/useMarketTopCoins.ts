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
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';

import { useToDetailPage } from '../../MarketTokenList/hooks/useToMarketDetailPage';
import { getMarketTopCoinsRequestType } from '../marketTopCoinsCategoryUtils';

import { fetchMarketTopCoinsForPlatform } from './marketTopCoinsPlatformApi';

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
      if (
        travelModeManager.getRuntimeEnvironmentSync().profile.kind ===
        'travel-mode'
      ) {
        return;
      }
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

export type IMarketTopCoinsDataCache = Partial<
  Record<string, IMarketAssetListItem[]>
>;

export function useMarketTopCoins(
  options: IUseMarketTopCoinNavigationOptions & {
    categoryId?: string;
    dataCacheRef?: RefObject<IMarketTopCoinsDataCache | undefined>;
  } = {},
) {
  const handleItemPress = useMarketTopCoinNavigation(options);
  const requestType = getMarketTopCoinsRequestType(options.categoryId);
  const requestTypeRef = useRef(requestType);
  requestTypeRef.current = requestType;
  // The type whose latest request settled, successfully or not. Web failures
  // throw and leave `result` on the previous type, so `result` alone cannot
  // tell a settled failure from a request that has not started yet.
  const settledRequestTypeRef = useRef<string | undefined>(undefined);
  const {
    result,
    isLoading,
    run: refresh,
  } = usePromiseResult(
    async () => {
      try {
        const response = await fetchMarketTopCoinsForPlatform(requestType);
        return { requestType, response, failed: false };
      } catch (error) {
        if (!platformEnv.isNative) throw error;
        return { requestType, response: undefined, failed: true };
      } finally {
        if (requestTypeRef.current === requestType) {
          settledRequestTypeRef.current = requestType;
        }
      }
    },
    [requestType],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 50 }),
      revalidateOnReconnect: true,
      watchLoading: true,
    },
  );
  const localDataCacheRef = useRef<IMarketTopCoinsDataCache | undefined>(
    undefined,
  );
  const dataCacheRef = options.dataCacheRef ?? localDataCacheRef;
  // The previous sub-category's result stays around until the new request
  // settles; never render it under the newly selected chip.
  const currentResult =
    result?.requestType === requestType ? result : undefined;
  useEffect(() => {
    if (currentResult?.response) {
      dataCacheRef.current = {
        ...dataCacheRef.current,
        [requestType]: currentResult.response.list,
      };
    }
  }, [currentResult, dataCacheRef, requestType]);
  const currentList =
    currentResult?.response?.list ?? dataCacheRef.current?.[requestType];
  const data = currentList ?? EMPTY_MARKET_ASSET_LIST;
  // usePromiseResult starts the new request in an effect, so the first render
  // after a chip switch still carries the previous request's settled loading
  // state. Report the unsettled type as loading instead of as an empty list.
  const isRequestPending =
    currentList === undefined && settledRequestTypeRef.current !== requestType;

  return {
    data,
    handleItemPress,
    isLoading: isRequestPending ? true : isLoading,
    isError: Boolean(currentResult?.failed),
    refresh,
  };
}
