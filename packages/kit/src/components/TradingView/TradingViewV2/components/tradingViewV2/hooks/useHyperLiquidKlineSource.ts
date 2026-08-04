import { useEffect, useMemo, useState } from 'react';

import { useNetInfo } from '@onekeyhq/components';
import {
  fetchMarketBasicConfigForPlatform,
  getLastMarketBasicConfigForPlatform,
  subscribeMarketBasicConfigForPlatform,
} from '@onekeyhq/kit/src/views/Market/hooks/useMarketBasicConfig/fetchMarketBasicConfigForPlatform';

import {
  getPreparedHyperLiquidKlineSource,
  resolveHyperLiquidKlineSource,
} from './hyperLiquidKlineSource';

import type { IHyperLiquidKlineSourceResult } from './hyperLiquidKlineSource';

export function useHyperLiquidKlineSource(
  networkId: string,
  tokenAddress: string,
): IHyperLiquidKlineSourceResult {
  const identityKey = `${networkId}:${tokenAddress}`;
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
  const shouldLoadConfig = immediateResult === undefined;
  const { isRawInternetReachable } = useNetInfo(shouldLoadConfig);
  const [asyncResult, setAsyncResult] = useState<{
    identityKey: string;
    result: IHyperLiquidKlineSourceResult;
  }>();

  useEffect(() => {
    if (!shouldLoadConfig) {
      return undefined;
    }

    let isActive = true;
    const applyConfig = (
      basicConfig: Parameters<
        typeof resolveHyperLiquidKlineSource
      >[0]['basicConfig'],
    ) => {
      if (!isActive) {
        return;
      }
      const result = resolveHyperLiquidKlineSource({
        basicConfig,
        isLoading: false,
        networkId,
        tokenAddress,
      });
      setAsyncResult((currentResult) => {
        if (
          currentResult?.identityKey === identityKey &&
          currentResult.result.isHyperLiquidSource ===
            result.isHyperLiquidSource &&
          currentResult.result.symbol === result.symbol &&
          currentResult.result.isLoading === result.isLoading
        ) {
          return currentResult;
        }
        return { identityKey, result };
      });
    };
    const unsubscribe = subscribeMarketBasicConfigForPlatform((response) => {
      applyConfig(response.data);
    });

    if (isRawInternetReachable !== false) {
      void fetchMarketBasicConfigForPlatform().then(
        (response) => applyConfig(response.data),
        () => applyConfig(undefined),
      );
    }

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [
    identityKey,
    isRawInternetReachable,
    networkId,
    shouldLoadConfig,
    tokenAddress,
  ]);

  if (immediateResult) {
    return immediateResult;
  }
  if (asyncResult?.identityKey === identityKey) {
    return asyncResult.result;
  }
  return {
    isHyperLiquidSource: false,
    symbol: undefined,
    isLoading: true,
  };
}
