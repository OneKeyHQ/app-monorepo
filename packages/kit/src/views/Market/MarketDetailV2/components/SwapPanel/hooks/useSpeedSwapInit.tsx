import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { mevSwapNetworks } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISpeedSwapConfig } from '@onekeyhq/shared/types/swap/types';

import type { IToken } from '../types';

const defaultSpeedSwapConfig: ISpeedSwapConfig = {
  provider: '',
  speedConfig: {
    spenderAddress: '',
    slippage: 0.5,
    defaultTokens: [],
    swapMevNetConfig: mevSwapNetworks,
  },
  supportSpeedSwap: false,
  speedDefaultSelectToken: undefined,
};

export function useSpeedSwapInit(
  networkId: string,
  enableNoNetworkCheck?: boolean,
) {
  const { result, isLoading } = usePromiseResult(
    async () => {
      if (enableNoNetworkCheck && !networkId) {
        return defaultSpeedSwapConfig;
      }
      const config = await backgroundApiProxy.serviceSwap.fetchSpeedSwapConfig({
        networkId,
      });
      return config;
    },
    [enableNoNetworkCheck, networkId],
    {
      initResult: defaultSpeedSwapConfig,
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
    speedDefaultSelectToken: result?.speedDefaultSelectToken,
  };
}
