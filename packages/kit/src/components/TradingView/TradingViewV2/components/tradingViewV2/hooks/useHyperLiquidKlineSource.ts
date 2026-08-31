import { useEffect, useMemo, useState } from 'react';

import { useNetInfo } from '@onekeyhq/components';
import {
  fetchMarketBasicConfigForPlatform,
  getCachedMarketBasicConfigForPlatform,
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
  const freshBasicConfig = getCachedMarketBasicConfigForPlatform();
  const immediateResult = useMemo(() => {
    if (freshBasicConfig) {
      return resolveHyperLiquidKlineSource({
        basicConfig: freshBasicConfig.data,
        isLoading: false,
        networkId,
        tokenAddress,
      });
    }

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
  }, [freshBasicConfig, networkId, tokenAddress]);
  const shouldLoadConfig = freshBasicConfig === undefined;
  const hasImmediateResult = immediateResult !== undefined;
  const { isRawInternetReachable } = useNetInfo(shouldLoadConfig);
  const [asyncResult, setAsyncResult] = useState<{
    identityKey: string;
    result: IHyperLiquidKlineSourceResult;
  }>();

  useEffect(() => {
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

    if (shouldLoadConfig && isRawInternetReachable !== false) {
      void fetchMarketBasicConfigForPlatform().then(
        (response) => applyConfig(response.data),
        () => {
          if (!hasImmediateResult) {
            applyConfig(undefined);
          }
        },
      );
    }

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [
    identityKey,
    hasImmediateResult,
    isRawInternetReachable,
    networkId,
    shouldLoadConfig,
    tokenAddress,
  ]);

  if (asyncResult?.identityKey === identityKey) {
    return asyncResult.result;
  }
  if (immediateResult) {
    return immediateResult;
  }
  return {
    isHyperLiquidSource: false,
    symbol: undefined,
    isLoading: true,
  };
}
