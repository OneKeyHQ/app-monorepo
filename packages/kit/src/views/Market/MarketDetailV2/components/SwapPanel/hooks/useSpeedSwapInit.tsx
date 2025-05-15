import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

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
          slippage: 0.5,
          defaultTokens: [],
        },
        supportSpeedSwap: false,
      },
      watchLoading: true,
    },
  );

  return {
    isLoading,
    speedConfig: result?.speedConfig,
    supportSpeedSwap: result?.supportSpeedSwap,
    provider: result?.provider,
  };
}
