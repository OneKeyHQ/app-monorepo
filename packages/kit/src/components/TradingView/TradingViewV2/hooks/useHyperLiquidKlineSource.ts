import { useMemo } from 'react';

import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks/useMarketBasicConfig';
import type { IMarketBasicConfigHyperLiquidKlineSourceToken } from '@onekeyhq/shared/types/marketV2';

export interface IHyperLiquidKlineSourceResult {
  isHyperLiquidSource: boolean;
  symbol: string | undefined;
  isLoading: boolean;
}

// Module-level cache: survives across component instances.
// Populated when Market list page (or any page) fetches basic config,
// so by the time the user opens a token detail page the cache is warm
// and the hook can resolve synchronously — no render blocking needed.
let cachedTokens: IMarketBasicConfigHyperLiquidKlineSourceToken[] | undefined;

export function useHyperLiquidKlineSource(
  networkId: string,
  tokenAddress: string,
): IHyperLiquidKlineSourceResult {
  const { basicConfig, isLoading } = useMarketBasicConfig();

  return useMemo(() => {
    const freshTokens = basicConfig?.HyperLiquidKlineSourceTokens;

    // Sync module cache only when we have a valid config response.
    // - basicConfig exists + field present → update cache
    // - basicConfig exists + field removed → clear cache (server intent)
    // - basicConfig is undefined (API error) → preserve cache to avoid regression
    if (isLoading === false && basicConfig) {
      cachedTokens = freshTokens;
    }

    // Use fresh data first, fall back to module cache during loading
    const tokens = freshTokens ?? cachedTokens;

    // Only report loading when we have NO data at all (true cold start)
    if (isLoading !== false && !tokens) {
      return {
        isHyperLiquidSource: false,
        symbol: undefined,
        isLoading: true,
      };
    }

    if (!tokens) {
      return {
        isHyperLiquidSource: false,
        symbol: undefined,
        isLoading: false,
      };
    }

    const match = tokens.find(
      (token) =>
        token.networkId === networkId && token.tokenAddress === tokenAddress,
    );

    return {
      isHyperLiquidSource: !!match,
      symbol: match?.symbol,
      isLoading: false,
    };
  }, [basicConfig, isLoading, networkId, tokenAddress]);
}
