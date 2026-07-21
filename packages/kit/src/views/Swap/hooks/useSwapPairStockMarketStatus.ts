import { useEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  type ISwapPairStockMarketStatus,
  type ISwapTokenMarketDetailState,
  getCurrentSwapPairStockMarketStatus,
  getSwapPairMarketStatusScope,
  resolveSwapPairStockMarketStatus,
} from '../utils/usMarketStatusUtils';

const MARKET_STATUS_POLLING_INTERVAL = timerUtils.getTimeDurationMs({
  seconds: 10,
});

async function fetchSwapTokenMarketDetail(
  token: ISwapToken,
): Promise<ISwapTokenMarketDetailState> {
  try {
    const response =
      await backgroundApiProxy.serviceMarketV2.fetchMarketTokenDetailByTokenAddress(
        token.contractAddress ?? '',
        token.networkId,
        {
          autoHandleError: false,
        },
      );
    if (response?.code !== 0 || !response?.data?.token) {
      return { unavailable: true };
    }
    return {
      unavailable: false,
      token: response.data.token,
      perpsInfo: response.data.perpsInfo,
    };
  } catch {
    return { unavailable: true };
  }
}

const EMPTY_MARKET_STATUS: ISwapPairStockMarketStatus = {
  scope: '',
  hasStockToken: false,
  unavailable: false,
};

export function useSwapPairStockMarketStatus() {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const scope = getSwapPairMarketStatusScope({
    swapTypeSwitch,
    fromToken,
    toToken,
  });
  const fromTokenRef = useRef(fromToken);
  const toTokenRef = useRef(toToken);
  fromTokenRef.current = fromToken;
  toTokenRef.current = toToken;

  const { result, setStopPolling } = usePromiseResult(
    async () => {
      const currentFromToken = fromTokenRef.current;
      const currentToToken = toTokenRef.current;
      if (!scope || !currentFromToken || !currentToToken) {
        return EMPTY_MARKET_STATUS;
      }

      const [fromTokenDetail, toTokenDetail] = await Promise.all([
        fetchSwapTokenMarketDetail(currentFromToken),
        fetchSwapTokenMarketDetail(currentToToken),
      ]);
      return resolveSwapPairStockMarketStatus({
        scope,
        fromTokenDetail,
        toTokenDetail,
      });
    },
    [scope],
    {
      initResult: EMPTY_MARKET_STATUS,
      pollingInterval: MARKET_STATUS_POLLING_INTERVAL,
    },
  );
  const currentStatus = useMemo(
    () =>
      getCurrentSwapPairStockMarketStatus({
        scope,
        result,
      }),
    [result, scope],
  );
  const shouldPoll = Boolean(
    scope &&
    (!currentStatus ||
      currentStatus.hasStockToken ||
      currentStatus.unavailable),
  );

  useEffect(() => {
    setStopPolling(!shouldPoll);
  }, [setStopPolling, shouldPoll]);

  return currentStatus;
}
