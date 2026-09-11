import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { MARKET_PERPS_DEFAULT_CATEGORY_ID } from '../constants';

import { mapServerToken } from './marketPerpsTokenUtils';

import type { IMarketPerpsToken } from './marketPerpsTokenUtils';

export { mapServerToken };
export type { IMarketPerpsToken };

export interface IMarketPerpsDataCache {
  categoryId: string;
  tokens: IMarketPerpsToken[];
}

interface IUseMarketPerpsTokenListParams {
  selectedCategoryId: string;
  dataCacheRef?: RefObject<IMarketPerpsDataCache | undefined>;
}

export function useMarketPerpsTokenList({
  selectedCategoryId,
  dataCacheRef: pageDataCacheRef,
}: IUseMarketPerpsTokenListParams) {
  const requestCategoryId =
    selectedCategoryId || MARKET_PERPS_DEFAULT_CATEGORY_ID;

  // Fetch token list from backend (pre-sorted, pre-computed, pre-filtered by category)
  const {
    result,
    isLoading,
    run: refresh,
  } = usePromiseResult(
    async () => {
      try {
        const [tokenListData, tokenSearchAliases] = await Promise.all([
          backgroundApiProxy.serviceMarketV2.fetchMarketPerpsTokenList({
            category: requestCategoryId,
          }),
          backgroundApiProxy.serviceHyperliquid.getTokenSearchAliases(),
        ]);
        return {
          categoryId: requestCategoryId,
          tokenListData,
          tokenSearchAliases,
          failed: false,
        };
      } catch (error) {
        if (!platformEnv.isNative) throw error;
        return {
          categoryId: requestCategoryId,
          tokenListData: undefined,
          tokenSearchAliases: undefined,
          failed: true,
        };
      }
    },
    [requestCategoryId],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 30 }),
      watchLoading: true,
      revalidateOnReconnect: platformEnv.isNative,
    },
  );

  const localDataCacheRef = useRef<IMarketPerpsDataCache | undefined>(
    undefined,
  );
  const dataCacheRef = pageDataCacheRef ?? localDataCacheRef;
  const hasCurrentResult = Boolean(
    result && !result.failed && result.categoryId === requestCategoryId,
  );
  const canUseCachedData = Boolean(result?.failed || pageDataCacheRef);
  const hasCurrentCategoryData =
    hasCurrentResult ||
    (canUseCachedData &&
      dataCacheRef.current?.categoryId === requestCategoryId);

  const tokens = useMemo(() => {
    if (!hasCurrentResult) {
      return canUseCachedData &&
        dataCacheRef.current?.categoryId === requestCategoryId
        ? dataCacheRef.current.tokens
        : [];
    }
    return (result?.tokenListData?.tokens ?? []).map((serverToken) =>
      mapServerToken(serverToken, result?.tokenSearchAliases),
    );
  }, [
    canUseCachedData,
    dataCacheRef,
    hasCurrentResult,
    requestCategoryId,
    result,
  ]);
  useEffect(() => {
    if (hasCurrentResult) {
      dataCacheRef.current = { categoryId: requestCategoryId, tokens };
    }
  }, [dataCacheRef, hasCurrentResult, requestCategoryId, tokens]);

  const isCategoryPending = !requestCategoryId;
  const isInitialLoading = Boolean(
    requestCategoryId && isLoading && !hasCurrentCategoryData,
  );
  const hasRealTimeData = hasCurrentCategoryData && tokens.length > 0;

  return {
    tokens,
    isLoading:
      Boolean(isLoading) ||
      isCategoryPending ||
      isInitialLoading ||
      (platformEnv.isNative && isLoading === undefined),
    isError: Boolean(result?.failed && result.categoryId === requestCategoryId),
    hasRealTimeData,
    refresh,
  };
}
