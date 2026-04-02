import { useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { mevSwapNetworks } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISpeedSwapConfig } from '@onekeyhq/shared/types/swap/types';

import type { IToken } from '../types';

const defaultSpeedSwapConfig: ISpeedSwapConfig = {
  provider: '',
  speedConfig: {
    spenderAddress: '',
    slippage: 0.5,
    defaultTokens: [],
    defaultLimitTokens: [],
    swapMevNetConfig: mevSwapNetworks,
  },
  supportSpeedSwap: undefined,
  onlySupportCrossChain: false,
  onlySupportSingleChain: false,
  speedDefaultSelectToken: undefined,
};

export function useSpeedSwapInit(
  networkId: string,
  enableNoNetworkCheck?: boolean,
) {
  const [speedSwapConfigLoading, setSpeedSwapConfigLoading] = useState(false);
  const [speedSwapConfig, setSpeedSwapConfig] = useState<ISpeedSwapConfig>(
    defaultSpeedSwapConfig,
  );
  useEffect(() => {
    void (async () => {
      if (enableNoNetworkCheck && !networkId) {
        setSpeedSwapConfigLoading(false);
        setSpeedSwapConfig(defaultSpeedSwapConfig);
        return;
      }
      setSpeedSwapConfigLoading(true);
      const config = await backgroundApiProxy.serviceSwap.fetchSpeedSwapConfig({
        networkId,
      });
      setSpeedSwapConfig(config);
      setSpeedSwapConfigLoading(false);
    })();
  }, [enableNoNetworkCheck, networkId]);

  return {
    defaultTokens: speedSwapConfig?.speedConfig.defaultTokens as IToken[],
    defaultLimitTokens: speedSwapConfig?.speedConfig
      .defaultLimitTokens as IToken[],
    isLoading: !!speedSwapConfigLoading,
    speedConfig: speedSwapConfig?.speedConfig,
    supportSpeedSwap: speedSwapConfig?.supportSpeedSwap,
    onlySupportCrossChain: speedSwapConfig?.onlySupportCrossChain,
    provider: speedSwapConfig?.provider,
    swapMevNetConfig: speedSwapConfig?.speedConfig.swapMevNetConfig,
    speedDefaultSelectToken: speedSwapConfig?.speedDefaultSelectToken,
  };
}
