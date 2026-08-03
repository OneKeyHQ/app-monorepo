import { useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  type IStockTokenDetailFetchState,
  getStockTokenDetailDisplaySeed,
  isStockTokenDetailStateLanded,
} from '../utils/stockTokenDetailFreshness';

import { getTokenIdentityKey } from './swapStockChannelUtils';

const SWAP_STOCK_DETAIL_POLLING_INTERVAL_MS = timerUtils.getTimeDurationMs({
  seconds: 10,
});
const EMPTY_STOCK_TOKEN_DETAIL_STATE: IStockTokenDetailFetchState = {
  scope: '',
  token: undefined,
  perpsInfo: undefined,
};

// Six polling ticks are enough to ride out a transient detail failure without
// letting stale market-open state survive a sustained endpoint outage.
const SWAP_STOCK_DETAIL_LAST_GOOD_TTL_MS = timerUtils.getTimeDurationMs({
  minute: 1,
});

let stockDetailMountSerial = 0;

function nextStockDetailMountId() {
  stockDetailMountSerial += 1;
  return `${Date.now()}-${stockDetailMountSerial}`;
}

export function useSwapStockTokenDetail({
  enabled = true,
  token,
}: {
  enabled?: boolean;
  token?: ISwapToken;
}) {
  const tokenKey = getTokenIdentityKey(token);
  const isActive = Boolean(enabled && token?.networkId && tokenKey);
  const tokenDetailScope = isActive ? tokenKey : '';
  const lastGoodTokenDetailRef = useRef<IStockTokenDetailFetchState | null>(
    null,
  );
  const mountIdRef = useRef('');
  if (!mountIdRef.current) {
    mountIdRef.current = nextStockDetailMountId();
  }

  // A response for a token that has already been replaced must not warm the
  // last-good snapshot used by the new token scope.
  const latestScopeRef = useRef(tokenDetailScope);
  latestScopeRef.current = tokenDetailScope;

  const { result: tokenDetailState, setStopPolling } = usePromiseResult(
    async () => {
      if (!isActive || !token?.networkId || !tokenKey) {
        return EMPTY_STOCK_TOKEN_DETAIL_STATE;
      }

      try {
        const response =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenDetailByTokenAddress(
            token.contractAddress ?? '',
            token.networkId,
            {
              autoHandleError: false,
            },
          );
        const responseToken = response?.data?.token;
        const nextState: IStockTokenDetailFetchState = {
          scope: tokenDetailScope,
          token: responseToken?.stock ? responseToken : undefined,
          perpsInfo: responseToken?.stock
            ? response?.data?.perpsInfo
            : undefined,
          fetchedAt: Date.now(),
        };
        if (latestScopeRef.current === tokenDetailScope) {
          lastGoodTokenDetailRef.current = nextState;
        }
        return nextState;
      } catch {
        let lastGood = lastGoodTokenDetailRef.current;
        if (lastGood?.scope !== tokenDetailScope) {
          const cached = tokenDetailScope
            ? swrCacheUtils.getWithTimestamp<IStockTokenDetailFetchState>(
                swrKeys.swapStockTokenDetail({
                  tokenScope: tokenDetailScope,
                }),
              )
            : undefined;
          if (
            cached?.data?.scope === tokenDetailScope &&
            cached.data.fetchedAt
          ) {
            lastGood = cached.data;
            lastGoodTokenDetailRef.current = lastGood;
          }
        }
        if (
          lastGood?.scope === tokenDetailScope &&
          lastGood.fetchedAt &&
          Date.now() - lastGood.fetchedAt <= SWAP_STOCK_DETAIL_LAST_GOOD_TTL_MS
        ) {
          return lastGood;
        }
        return {
          scope: tokenDetailScope,
          token: undefined,
          perpsInfo: undefined,
          fallbackOfMountId: mountIdRef.current,
        };
      }
    },
    [
      isActive,
      token?.contractAddress,
      token?.networkId,
      tokenDetailScope,
      tokenKey,
    ],
    {
      initResult: EMPTY_STOCK_TOKEN_DETAIL_STATE,
      // Keep the interval identity stable so enabling a quote-driven detail
      // check starts immediately instead of preserving the old cadence.
      pollingInterval: SWAP_STOCK_DETAIL_POLLING_INTERVAL_MS,
      swrKey:
        isActive && tokenDetailScope
          ? swrKeys.swapStockTokenDetail({
              tokenScope: tokenDetailScope,
            })
          : undefined,
    },
  );
  useEffect(() => {
    // Inactive hooks do one guarded no-op when their identity changes, then
    // stop their polling chain entirely. Re-enabling is handled by the same
    // usePromiseResult dependency transition without a second manual run.
    setStopPolling(!isActive);
  }, [isActive, setStopPolling, tokenKey]);

  const landed = isStockTokenDetailStateLanded({
    state: tokenDetailState,
    scope: tokenDetailScope,
    mountId: mountIdRef.current,
    ttlMs: SWAP_STOCK_DETAIL_LAST_GOOD_TTL_MS,
  });
  const displayTokenDetail = getStockTokenDetailDisplaySeed({
    state: tokenDetailState,
    scope: tokenDetailScope,
  });

  return {
    displayTokenDetail,
    pending: Boolean(tokenDetailScope) && !landed,
    perpsInfo: landed ? tokenDetailState?.perpsInfo : undefined,
    tokenDetail: landed ? tokenDetailState?.token : undefined,
  };
}
