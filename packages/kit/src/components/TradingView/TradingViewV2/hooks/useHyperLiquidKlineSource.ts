import { useMemo } from 'react';

import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks/useMarketBasicConfig';

export interface IHyperLiquidKlineSourceResult {
  isHyperLiquidSource: boolean;
  symbol: string | undefined;
  isLoading: boolean;
}

export function useHyperLiquidKlineSource(
  networkId: string,
  tokenAddress: string,
): IHyperLiquidKlineSourceResult {
  const { basicConfig, isLoading } = useMarketBasicConfig();

  return useMemo(() => {
    if (isLoading || !basicConfig?.HyperLiquidKlineSourceTokens) {
      return {
        isHyperLiquidSource: false,
        symbol: undefined,
        isLoading: true,
      };
    }

    const match = basicConfig.HyperLiquidKlineSourceTokens.find(
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
