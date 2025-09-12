import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { mevSwapNetworks } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import type { IToken } from '../types';

export function useSpeedSwapInit(networkId: string) {
  const { result, isLoading } = usePromiseResult(
    async () => {
      const config = await backgroundApiProxy.serviceSwap.fetchSpeedSwapConfig({
        networkId,
      });
      return config;
    },
    [networkId],
    {
      initResult: {
        provider: '',
        speedConfig: {
          spenderAddress: '',
          slippage: 0.5,
          defaultTokens: [],
          swapMevNetConfig: mevSwapNetworks,
        },
        supportSpeedSwap: false,
      },
      watchLoading: true,
    },
  );

  return {
    defaultTokens: result?.speedConfig.defaultTokens as IToken[],
    isLoading: !!isLoading,
    speedConfig: result?.speedConfig,
    supportSpeedSwap: result?.supportSpeedSwap,
    provider: result?.provider,
    swapMevNetConfig: result?.speedConfig.swapMevNetConfig,
  };
}
