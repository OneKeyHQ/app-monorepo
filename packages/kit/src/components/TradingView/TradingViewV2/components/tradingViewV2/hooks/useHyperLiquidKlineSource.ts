import { useMemo } from 'react';

import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import { getLastMarketBasicConfigForPlatform } from '@onekeyhq/kit/src/views/Market/hooks/useMarketBasicConfig/fetchMarketBasicConfigForPlatform';

import {
  getPreparedHyperLiquidKlineSource,
  resolveHyperLiquidKlineSource,
} from './hyperLiquidKlineSource';

import type { IHyperLiquidKlineSourceResult } from './hyperLiquidKlineSource';

export function useHyperLiquidKlineSource(
  networkId: string,
  tokenAddress: string,
): IHyperLiquidKlineSourceResult {
  const { basicConfig, isLoading } = useMarketBasicConfig();
  const immediateResult = useMemo(() => {
    const preparedResult = getPreparedHyperLiquidKlineSource({
      networkId,
      tokenAddress,
    });
    if (preparedResult) {
      return preparedResult;
    }

    const lastBasicConfig = getLastMarketBasicConfigForPlatform();
    return lastBasicConfig
      ? resolveHyperLiquidKlineSource({
          basicConfig: lastBasicConfig.data,
          isLoading: false,
          networkId,
          tokenAddress,
        })
      : undefined;
  }, [networkId, tokenAddress]);
  const reactiveResult = useMemo(
    () =>
      resolveHyperLiquidKlineSource({
        basicConfig,
        isLoading,
        networkId,
        tokenAddress,
      }),
    [basicConfig, isLoading, networkId, tokenAddress],
  );

  return immediateResult ?? reactiveResult;
}
