import { useEffect, useMemo, useState } from 'react';

import {
  fetchMarketBasicConfigForPlatform,
  getLastMarketBasicConfigForPlatform,
} from '@onekeyhq/kit/src/views/Market/hooks/useMarketBasicConfig/fetchMarketBasicConfigForPlatform';

import {
  getPreparedHyperLiquidKlineSource,
  prepareHyperLiquidKlineSource,
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
  const [asyncResult, setAsyncResult] = useState<{
    identityKey: string;
    result: IHyperLiquidKlineSourceResult;
  }>();

  useEffect(() => {
    if (immediateResult) {
      return;
    }

    let isActive = true;
    void fetchMarketBasicConfigForPlatform().then(
      (response) => {
        if (!isActive) {
          return;
        }
        setAsyncResult({
          identityKey,
          result: prepareHyperLiquidKlineSource({
            basicConfig: response.data,
            networkId,
            tokenAddress,
          }),
        });
      },
      () => {
        if (!isActive) {
          return;
        }
        setAsyncResult({
          identityKey,
          result: {
            isHyperLiquidSource: false,
            symbol: undefined,
            isLoading: false,
          },
        });
      },
    );

    return () => {
      isActive = false;
    };
  }, [identityKey, immediateResult, networkId, tokenAddress]);

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
