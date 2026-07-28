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
  isStockTokenDetailStateResolvedForActivation,
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

let stockDetailActivationSerial = 0;
let stockDetailMountSerial = 0;

function nextStockDetailActivationId() {
  stockDetailActivationSerial += 1;
  return `${Date.now()}-${stockDetailActivationSerial}`;
}

function nextStockDetailMountId() {
  stockDetailMountSerial += 1;
  return `${Date.now()}-${stockDetailMountSerial}`;
}

export function useSwapStockTokenDetail({
  enabled = true,
  requireCurrentActivation = false,
  token,
}: {
  enabled?: boolean;
  requireCurrentActivation?: boolean;
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
  const activationScopeRef = useRef<string | undefined>(undefined);
  const activationIdRef = useRef('');
  const activationScope = isActive ? tokenDetailScope : '';
  if (activationScopeRef.current !== activationScope) {
    activationScopeRef.current = activationScope;
    activationIdRef.current = activationScope
      ? nextStockDetailActivationId()
      : '';
  }
  const activationId = activationIdRef.current;

  // A response for a token that has already been replaced must not warm the
  // last-good snapshot used by the new token scope.
  const latestScopeRef = useRef(tokenDetailScope);
  latestScopeRef.current = tokenDetailScope;
  const latestActivationIdRef = useRef(activationId);
  latestActivationIdRef.current = activationId;

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
          resolvedByActivationId: activationId,
        };
        if (
          latestScopeRef.current === tokenDetailScope &&
          latestActivationIdRef.current === activationId
        ) {
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
          return {
            ...lastGood,
            isUsingLastGood: true,
            resolvedByActivationId: activationId,
          };
        }
        return {
          scope: tokenDetailScope,
          token: undefined,
          perpsInfo: undefined,
          fallbackOfMountId: mountIdRef.current,
          resolvedByActivationId: activationId,
        };
      }
    },
    [
      isActive,
      activationId,
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
  const currentActivationResolved =
    isStockTokenDetailStateResolvedForActivation({
      activationId,
      state: tokenDetailState,
      scope: tokenDetailScope,
    });
  const authoritativeStateLanded = requireCurrentActivation
    ? currentActivationResolved
    : landed;
  const displayTokenDetail = getStockTokenDetailDisplaySeed({
    state: tokenDetailState,
    scope: tokenDetailScope,
  });

  return {
    displayTokenDetail,
    fetchedAt: authoritativeStateLanded
      ? tokenDetailState?.fetchedAt
      : undefined,
    latestFetchSucceeded: Boolean(
      currentActivationResolved &&
      tokenDetailState?.fetchedAt &&
      !tokenDetailState.isUsingLastGood,
    ),
    pending: Boolean(tokenDetailScope) && !authoritativeStateLanded,
    perpsInfo: authoritativeStateLanded
      ? tokenDetailState?.perpsInfo
      : undefined,
    tokenDetail: authoritativeStateLanded ? tokenDetailState?.token : undefined,
  };
}
