import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { resolveMarketTopCoinNavigationTarget } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveMarketTopCoinNavigationTarget';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';

import { useToDetailPage } from '../../MarketTokenList/hooks/useToMarketDetailPage';
import { getMarketTopCoinsRequestType } from '../marketTopCoinsCategoryUtils';

import { fetchMarketTopCoinsForPlatform } from './marketTopCoinsPlatformApi';

const EMPTY_MARKET_ASSET_LIST: IMarketAssetListItem[] = [];

type IUseMarketTopCoinNavigationOptions = {
  replaceCurrentDetail?: boolean;
};

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

export function isMarketTopCoinNavigationSuppressed() {
  return (
    travelModeManager.getRuntimeEnvironmentSync().profile.kind === 'travel-mode'
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
    from: replaceCurrentDetail ? EEnterWay.DetailSwitch : EEnterWay.MarketList,
  });
  const isNavigatingRef = useRef(false);

  const handleItemPress = useCallback(
    async (item: IMarketAssetListItem) => {
      if (isMarketTopCoinNavigationSuppressed()) {
        return;
      }
      if (isNavigatingRef.current) {
        return;
      }
      isNavigatingRef.current = true;
      try {
        if (platformEnv.isNative) {
          await toMarketDetailPage({
            assetId: item.assetId,
            networkId: '',
            symbol: item.symbol.toUpperCase(),
            name: item.name,
            tokenAddress: '',
            tokenImageUri: item.logoUrl,
            price: item.price ? Number(item.price) : undefined,
            change24h: item.priceChange24hPercent
              ? Number(item.priceChange24hPercent)
              : undefined,
          });
          return;
        }
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
  // Distinguish a settled request from a category whose request has not started yet.
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
      } catch {
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
