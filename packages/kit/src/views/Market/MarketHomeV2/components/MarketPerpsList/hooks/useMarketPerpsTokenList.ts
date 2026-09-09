import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { MARKET_PERPS_DEFAULT_CATEGORY_ID } from '../constants';

import { mapServerToken } from './marketPerpsTokenUtils';

import type { IMarketPerpsToken } from './marketPerpsTokenUtils';

export { mapServerToken };
export type { IMarketPerpsToken };

interface IUseMarketPerpsTokenListParams {
  selectedCategoryId: string;
}

export function useMarketPerpsTokenList({
  selectedCategoryId,
}: IUseMarketPerpsTokenListParams) {
  const requestCategoryId =
    selectedCategoryId || MARKET_PERPS_DEFAULT_CATEGORY_ID;

  // Fetch token list from backend (pre-sorted, pre-computed, pre-filtered by category)
  const { result: apiData, isLoading } = usePromiseResult(
    async () => {
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
      };
    },
    [requestCategoryId],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 30 }),
      watchLoading: true,
    },
  );

  const hasCurrentCategoryData = apiData?.categoryId === requestCategoryId;

  // Map server tokens to display tokens (add subtitle from local aliases)
  const tokens = useMemo(() => {
    if (!hasCurrentCategoryData) {
      return [];
    }

    const serverTokens = apiData?.tokenListData?.tokens;
    if (!serverTokens || serverTokens.length === 0) return [];

    return serverTokens.map((serverToken) =>
      mapServerToken(serverToken, apiData?.tokenSearchAliases),
    );
    // Already sorted by volume descending and filtered by category from backend
  }, [apiData, hasCurrentCategoryData]);

  const isCategoryPending = !requestCategoryId;
  const isInitialLoading = Boolean(
    requestCategoryId && isLoading && !hasCurrentCategoryData,
  );
  const hasRealTimeData =
    hasCurrentCategoryData && (apiData?.tokenListData?.tokens?.length ?? 0) > 0;

  return {
    tokens,
    isLoading: Boolean(isLoading) || isCategoryPending || isInitialLoading,
    hasRealTimeData,
  };
}
