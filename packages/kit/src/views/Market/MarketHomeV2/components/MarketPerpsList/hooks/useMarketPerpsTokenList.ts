import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getTokenSubtitle } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { ITokenSearchAliases } from '@onekeyhq/shared/src/utils/perpsUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketPerpsTokenFromServer } from '@onekeyhq/shared/types/marketV2';

export interface IMarketPerpsToken {
  name: string;
  displayName: string;
  maxLeverage: number;
  subtitle?: string;
  tokenImageUrl: string;
  markPrice: string;
  prevDayPrice: string;
  change24hPercent: number;
  volume24h: string;
  openInterest: string;
  fundingRate: string;
}

interface IUseMarketPerpsTokenListParams {
  selectedCategoryId: string;
}

export function mapServerToken(
  token: IMarketPerpsTokenFromServer,
  tokenSearchAliases: ITokenSearchAliases | undefined,
): IMarketPerpsToken {
  return {
    name: token.name,
    displayName: token.displayName,
    maxLeverage: token.maxLeverage,
    subtitle: getTokenSubtitle(token.name, tokenSearchAliases),
    tokenImageUrl: token.tokenImageUrl,
    markPrice: token.markPrice,
    prevDayPrice: token.prevDayPrice,
    change24hPercent: token.change24hPercent,
    volume24h: token.volume24h,
    openInterest: token.openInterest,
    fundingRate: token.fundingRate,
  };
}

export function useMarketPerpsTokenList({
  selectedCategoryId,
}: IUseMarketPerpsTokenListParams) {
  // Fetch token list from backend (pre-sorted, pre-computed, pre-filtered by category)
  const { result: apiData, isLoading } = usePromiseResult(
    async () => {
      // Skip fetch until category is selected (avoid request without category param)
      if (!selectedCategoryId) {
        return { tokenListData: { tokens: [] }, tokenSearchAliases: undefined };
      }
      const [tokenListData, tokenSearchAliases] = await Promise.all([
        backgroundApiProxy.serviceMarketV2.fetchMarketPerpsTokenList({
          category: selectedCategoryId,
        }),
        backgroundApiProxy.serviceHyperliquid.getTokenSearchAliases(),
      ]);
      return { tokenListData, tokenSearchAliases };
    },
    [selectedCategoryId],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 30 }),
      watchLoading: true,
    },
  );

  // Map server tokens to display tokens (add subtitle from local aliases)
  const tokens = useMemo(() => {
    const serverTokens = apiData?.tokenListData?.tokens;
    if (!serverTokens || serverTokens.length === 0) return [];

    return serverTokens.map((serverToken) =>
      mapServerToken(serverToken, apiData?.tokenSearchAliases),
    );
    // Already sorted by volume descending and filtered by category from backend
  }, [apiData]);

  const hasRealTimeData = (apiData?.tokenListData?.tokens?.length ?? 0) > 0;

  return {
    tokens,
    isLoading,
    hasRealTimeData,
  };
}
