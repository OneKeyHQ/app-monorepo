import { useEffect, useRef, useState } from 'react';

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
  const requestIdRef = useRef(0);
  const speedSwapConfigScope = `${enableNoNetworkCheck ? '1' : '0'}:${networkId}`;
  const [speedSwapConfigLoading, setSpeedSwapConfigLoading] = useState(false);
  const [speedSwapConfigState, setSpeedSwapConfigState] = useState<{
    config: ISpeedSwapConfig;
    scope?: string;
  }>({
    config: defaultSpeedSwapConfig,
  });
  const speedSwapConfigReady =
    speedSwapConfigState.scope === speedSwapConfigScope;
  const speedSwapConfig = speedSwapConfigReady
    ? speedSwapConfigState.config
    : defaultSpeedSwapConfig;

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const updateIfCurrent = (callback: () => void) => {
      if (requestIdRef.current === requestId) {
        callback();
      }
    };

    void (async () => {
      if (enableNoNetworkCheck && !networkId) {
        updateIfCurrent(() => {
          setSpeedSwapConfigLoading(false);
          setSpeedSwapConfigState({
            config: defaultSpeedSwapConfig,
            scope: speedSwapConfigScope,
          });
        });
        return;
      }
      setSpeedSwapConfigLoading(true);
      try {
        const config =
          await backgroundApiProxy.serviceSwap.fetchSpeedSwapConfig({
            networkId,
          });
        updateIfCurrent(() => {
          setSpeedSwapConfigState({
            config,
            scope: speedSwapConfigScope,
          });
        });
      } catch {
        updateIfCurrent(() => {
          setSpeedSwapConfigState({
            config: defaultSpeedSwapConfig,
            scope: speedSwapConfigScope,
          });
        });
      } finally {
        updateIfCurrent(() => {
          setSpeedSwapConfigLoading(false);
        });
      }
    })();
  }, [enableNoNetworkCheck, networkId, speedSwapConfigScope]);

  return {
    defaultTokens: speedSwapConfig?.speedConfig.defaultTokens as IToken[],
    defaultLimitTokens: speedSwapConfig?.speedConfig
      .defaultLimitTokens as IToken[],
    isLoading: !!speedSwapConfigLoading,
    speedConfigReady: speedSwapConfigReady,
    speedConfig: speedSwapConfig?.speedConfig,
    supportSpeedSwap: speedSwapConfig?.supportSpeedSwap,
    onlySupportCrossChain: speedSwapConfig?.onlySupportCrossChain,
    provider: speedSwapConfig?.provider,
    swapMevNetConfig: speedSwapConfig?.speedConfig.swapMevNetConfig,
    speedDefaultSelectToken: speedSwapConfig?.speedDefaultSelectToken,
  };
}
