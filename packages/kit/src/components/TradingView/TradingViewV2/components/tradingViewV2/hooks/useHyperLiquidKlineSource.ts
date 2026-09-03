import { useMemo } from 'react';

import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks/useMarketBasicConfig';

export interface IHyperLiquidKlineSourceResult {
  isHyperLiquidSource: boolean;
  symbol: string | undefined;
  isLoading: boolean;
}

interface IUseHyperLiquidKlineSourceOptions {
  disabled?: boolean;
}

export function useHyperLiquidKlineSource(
  networkId: string,
  tokenAddress: string,
  options?: IUseHyperLiquidKlineSourceOptions,
): IHyperLiquidKlineSourceResult {
  const { basicConfig, isLoading } = useMarketBasicConfig();
  const disabled = options?.disabled;

  return useMemo(() => {
    if (disabled) {
      return {
        isHyperLiquidSource: false,
        symbol: undefined,
        isLoading: false,
      };
    }

    if (!basicConfig) {
      return {
        isHyperLiquidSource: false,
        symbol: undefined,
        isLoading: isLoading !== false,
      };
    }

    if (!basicConfig.HyperLiquidKlineSourceTokens) {
      return {
        isHyperLiquidSource: false,
        symbol: undefined,
        isLoading: false,
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
  }, [basicConfig, disabled, isLoading, networkId, tokenAddress]);
}
