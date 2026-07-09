import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapStockExecutionTokensAtom,
  useSwapStockSelectedTokenAtom,
  useSwapToTokenAmountAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { isOndoStockSource } from '@onekeyhq/kit/src/views/Market/components/utils/stockSource';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IFetchUSMarketStatusResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapSelectTokenSource } from '@onekeyhq/shared/types/swap/types';

import { isStockTokenDetailStateLanded } from '../utils/stockTokenDetailFreshness';
import {
  SWAP_STOCK_ANALYTICS_TOKEN_LIST_TYPE_DEFAULT,
  SWAP_STOCK_ANALYTICS_TOKEN_LIST_TYPE_STOCK,
  SWAP_STOCK_ANALYTICS_TOKEN_ROLE_PAY,
  SWAP_STOCK_ANALYTICS_TOKEN_ROLE_STOCK,
} from '../utils/swapStockAnalytics';

import {
  ESwapStockChannelAsyncStatus,
  ESwapStockChannelStage,
  ESwapStockTradeSide,
  buildStockSwapTokenFromMarketToken,
  filterStockPayTokenCandidates,
  getTokenIdentityKey,
  resolveStockChannelSwapPair,
  shouldResetStockTradeReceiveAmount,
} from './swapStockChannelUtils';
import { useSwapStockDefaultToken } from './useSwapStockDefaultToken';
import { useSwapStockMarketWebSocket } from './useSwapStockMarketWebSocket';
import { useSwapStockPayTokens } from './useSwapStockPayTokens';

import type { IStockTokenDetailFetchState } from '../utils/stockTokenDetailFreshness';

export {
  ESwapStockChannelAsyncStatus,
  ESwapStockChannelStage,
  ESwapStockTradeSide,
} from './swapStockChannelUtils';

// How long a failed detail poll may keep serving the last successful
// payload before the channel degrades to unavailable. Six 10s ticks —
// long enough to ride out transient network blips, short enough that a
// persistently broken endpoint cannot show a stale market open/closed
// state for more than a minute.
const SWAP_STOCK_DETAIL_LAST_GOOD_TTL_MS = timerUtils.getTimeDurationMs({
  minute: 1,
});

let stockDetailMountSerial = 0;

function nextStockDetailMountId() {
  stockDetailMountSerial += 1;
  // Time component keeps ids from a previous app session (already
  // persisted inside cached fallback payloads) from colliding with a
  // fresh session's serial numbers.
  return `${Date.now()}-${stockDetailMountSerial}`;
}

let stockExecutionTokenSyncSerial = 0;

function nextStockExecutionTokenSyncId() {
  stockExecutionTokenSyncSerial += 1;
  return stockExecutionTokenSyncSerial;
}

function buildStockExecutionTokens({
  payToken,
  stockToken,
  tradeSide,
}: {
  payToken?: ISwapToken;
  stockToken?: ISwapToken;
  tradeSide: ESwapStockTradeSide;
}) {
  const fromToken =
    tradeSide === ESwapStockTradeSide.Buy ? payToken : stockToken;
  const toToken = tradeSide === ESwapStockTradeSide.Buy ? stockToken : payToken;

  return { fromToken, toToken };
}

function normalizeSelectedStockSwapToken(token: ISwapToken) {
  return token.isStock ? token : { ...token, isStock: true };
}

type ISelectStockSwapTokenOptions = {
  resetReceiveAmount?: boolean;
};

export function useSwapStockChannel() {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [stockExecutionTokens] = useSwapStockExecutionTokensAtom();
  const [stockSelectedToken, setStockSelectedToken] =
    useSwapStockSelectedTokenAtom();
  const [, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setToTokenAmount] = useSwapToTokenAmountAtom();
  const { selectStockExecutionTokens } = useSwapActions().current;
  const { spotCategories } = useMarketBasicConfig();
  const [tradeSideState, setTradeSideState] = useState<
    ESwapStockTradeSide | undefined
  >(undefined);
  const [stockTokenState, setStockTokenState] = useState<
    ISwapToken | undefined
  >(undefined);
  const [payTokenState, setPayTokenState] = useState<ISwapToken | undefined>(
    undefined,
  );
  const manualStockPayTokenKeyRef = useRef('');
  const stockTokenSnapshotRef = useRef<ISwapToken | undefined>(undefined);
  const payTokenSnapshotRef = useRef<ISwapToken | undefined>(undefined);

  const selectedTokensStockPair = useMemo(
    () =>
      resolveStockChannelSwapPair({
        fromToken,
        toToken,
      }),
    [fromToken, toToken],
  );
  const executionTokensStockPair = useMemo(
    () =>
      resolveStockChannelSwapPair({
        fromToken: stockExecutionTokens?.fromToken,
        toToken: stockExecutionTokens?.toToken,
      }),
    [stockExecutionTokens?.fromToken, stockExecutionTokens?.toToken],
  );
  const hasStockExecutionPair = Boolean(
    executionTokensStockPair.stockToken ?? executionTokensStockPair.payToken,
  );
  const stockPair = hasStockExecutionPair
    ? executionTokensStockPair
    : selectedTokensStockPair;
  const tradeSide =
    tradeSideState ?? stockPair.tradeSide ?? ESwapStockTradeSide.Buy;
  const isBuySide = tradeSide === ESwapStockTradeSide.Buy;
  const swapPairPayToken = isBuySide ? fromToken : toToken;
  const persistedStockSelectedToken = stockSelectedToken?.isStock
    ? stockSelectedToken
    : undefined;
  const selectedStockToken =
    stockTokenState ?? persistedStockSelectedToken ?? stockPair.stockToken;
  const selectedStockTokenKey = getTokenIdentityKey(selectedStockToken);
  const currentStockToken = selectedStockToken;
  const currentStockTokenKey = getTokenIdentityKey(currentStockToken);
  const swapPairStockPayToken = useMemo(
    () =>
      filterStockPayTokenCandidates(
        swapPairPayToken ? [swapPairPayToken] : [],
      )[0],
    [swapPairPayToken],
  );
  const stockPairPayToken =
    stockPair.tradeSide === tradeSide ? stockPair.payToken : undefined;
  const payToken = payTokenState ?? stockPairPayToken ?? swapPairStockPayToken;
  const stockNetworkId = currentStockToken?.networkId ?? '';
  const stockTokenDetailScope = currentStockTokenKey;
  const lastGoodStockTokenDetailRef =
    useRef<IStockTokenDetailFetchState | null>(null);
  const stockDetailMountIdRef = useRef('');
  if (!stockDetailMountIdRef.current) {
    stockDetailMountIdRef.current = nextStockDetailMountId();
  }
  // Tracks the scope of the latest render so a superseded in-flight request
  // (user already switched stock) cannot clobber the last-good snapshot of
  // the currently selected stock.
  const latestStockTokenDetailScopeRef = useRef(stockTokenDetailScope);
  latestStockTokenDetailScopeRef.current = stockTokenDetailScope;
  const { result: stockTokenDetailState } = usePromiseResult(
    async () => {
      if (!currentStockToken?.networkId || !currentStockTokenKey) {
        return {
          scope: stockTokenDetailScope,
          token: undefined,
          perpsInfo: undefined,
        };
      }
      try {
        const response =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenDetailByTokenAddress(
            currentStockToken.contractAddress ?? '',
            currentStockToken.networkId,
            {
              autoHandleError: false,
            },
          );
        const token = response?.data?.token;
        const nextState: IStockTokenDetailFetchState = {
          scope: stockTokenDetailScope,
          token: token?.stock ? token : undefined,
          perpsInfo: token?.stock ? response?.data?.perpsInfo : undefined,
          fetchedAt: Date.now(),
        };
        // A superseded response (user already switched stock while this
        // request was in flight) must not overwrite the snapshot;
        // usePromiseResult already discards its result via the nonce guard.
        if (latestStockTokenDetailScopeRef.current === stockTokenDetailScope) {
          lastGoodStockTokenDetailRef.current = nextState;
        }
        return nextState;
      } catch {
        // A transient polling failure must not wipe the channel state:
        // an undefined stock detail degrades channelStage to MissingStock
        // and resets the trade UI. Keep the last successful payload for
        // the same token scope instead — but only within a bounded window,
        // so a persistently broken endpoint (delisted token, backend down)
        // cannot show a stale market open/closed state indefinitely; after
        // the TTL the channel settles into the stable unavailable state.
        let lastGood = lastGoodStockTokenDetailRef.current;
        if (lastGood?.scope !== stockTokenDetailScope) {
          // Re-entering the page: the render state was hydrated from the
          // SWR cache, but no request has succeeded in this mount yet, so
          // the in-memory snapshot is empty. Warm it from the same cache
          // entry so a failing first tick after remount does not clear the
          // trade UI. Only the fetchedAt carried inside the payload is
          // trusted for the TTL — the cache entry's own timestamp gets
          // re-stamped every time this fallback result is re-persisted,
          // which would otherwise renew the TTL indefinitely across
          // remounts; legacy entries without fetchedAt are ignored.
          const cached = stockTokenDetailScope
            ? swrCacheUtils.getWithTimestamp<IStockTokenDetailFetchState>(
                swrKeys.swapStockTokenDetail({
                  tokenScope: stockTokenDetailScope,
                }),
              )
            : undefined;
          if (
            cached?.data?.scope === stockTokenDetailScope &&
            cached.data.fetchedAt
          ) {
            lastGood = cached.data;
            lastGoodStockTokenDetailRef.current = lastGood;
          }
        }
        if (
          lastGood?.scope === stockTokenDetailScope &&
          lastGood.fetchedAt &&
          Date.now() - lastGood.fetchedAt <= SWAP_STOCK_DETAIL_LAST_GOOD_TTL_MS
        ) {
          return lastGood;
        }
        // Deliberately WITHOUT fetchedAt: this fallback empty is not a
        // real server answer. The mount id lets it settle THIS mount to
        // MarketUnavailable after an extended outage, while a persisted
        // copy hydrated on a later mount stays pending until the first
        // real request resolves.
        return {
          scope: stockTokenDetailScope,
          token: undefined,
          perpsInfo: undefined,
          fallbackOfMountId: stockDetailMountIdRef.current,
        };
      }
    },
    [
      currentStockToken?.contractAddress,
      currentStockToken?.networkId,
      currentStockTokenKey,
      stockTokenDetailScope,
    ],
    {
      initResult: {
        scope: '',
        token: undefined,
        perpsInfo: undefined,
      },
      // Market open/closed state (stock.isOpen / description) is only
      // carried by this endpoint — the market WebSocket pushes price only —
      // so poll it while the tab stays mounted to keep the closed alert,
      // the disabled trade button and the K-line pulse dot in sync with
      // the actual market session (OK-57346). 10s matches Swap Pro's
      // token-detail polling cadence.
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 10 }),
      swrKey: stockTokenDetailScope
        ? swrKeys.swapStockTokenDetail({
            tokenScope: stockTokenDetailScope,
          })
        : undefined,
    },
  );
  // Semantics and invariants documented (and unit-tested) in
  // ../utils/stockTokenDetailFreshness.ts — anything not landed keeps the
  // channel pending (Initializing) until a real request resolves.
  const stockTokenDetailLanded = isStockTokenDetailStateLanded({
    state: stockTokenDetailState,
    scope: stockTokenDetailScope,
    mountId: stockDetailMountIdRef.current,
    ttlMs: SWAP_STOCK_DETAIL_LAST_GOOD_TTL_MS,
  });
  const stockTokenDetail = stockTokenDetailLanded
    ? stockTokenDetailState?.token
    : undefined;
  const stockPerpsInfo = stockTokenDetailLanded
    ? stockTokenDetailState?.perpsInfo
    : undefined;
  const stockTokenDetailPending =
    !!currentStockTokenKey && !stockTokenDetailLanded;
  const { realtimeChartPoint, realtimeTokenDetail: activeStockTokenDetail } =
    useSwapStockMarketWebSocket({
      currentStockToken,
      enabled: !!currentStockTokenKey,
      tokenDetail: stockTokenDetail,
    });
  const disableNativePayToken = isOndoStockSource(
    activeStockTokenDetail?.stock?.source,
  );

  const syncStockExecutionTokens = useCallback(
    async ({
      nextTradeSide = tradeSide,
      stockToken = stockTokenSnapshotRef.current ?? currentStockToken,
      payToken: nextPayToken = payTokenSnapshotRef.current ?? payToken,
    }: {
      nextTradeSide?: ESwapStockTradeSide;
      stockToken?: ISwapToken;
      payToken?: ISwapToken;
    } = {}) => {
      // The stock channel token is authoritatively the stock side of the trade.
      // Stock metadata (token.stock) loads asynchronously and may be missing at
      // selection time, which left isStock unset and made the history list label
      // the trade as "Swap" instead of Buy/Sell. Flag it here so the recorded
      // execution tokens carry isStock end-to-end.
      const flaggedStockToken =
        stockToken && !stockToken.isStock
          ? { ...stockToken, isStock: true }
          : stockToken;
      const nextFromToken =
        nextTradeSide === ESwapStockTradeSide.Buy
          ? nextPayToken
          : flaggedStockToken;
      const nextToToken =
        nextTradeSide === ESwapStockTradeSide.Buy
          ? flaggedStockToken
          : nextPayToken;

      await selectStockExecutionTokens({
        fromToken: nextFromToken,
        toToken: nextToToken,
        syncId: nextStockExecutionTokenSyncId(),
      });
    },
    [currentStockToken, payToken, selectStockExecutionTokens, tradeSide],
  );

  useEffect(() => {
    if (currentStockToken) {
      stockTokenSnapshotRef.current = currentStockToken;
    }
  }, [currentStockToken]);

  useEffect(() => {
    if (payToken) {
      payTokenSnapshotRef.current = payToken;
    }
  }, [payToken]);

  const resetStockTradeAmounts = useCallback(() => {
    setFromTokenAmount({ value: '', isInput: false });
    setToTokenAmount({ value: '', isInput: false });
  }, [setFromTokenAmount, setToTokenAmount]);

  const resetStockTradeReceiveAmount = useCallback(() => {
    setToTokenAmount({ value: '', isInput: false });
  }, [setToTokenAmount]);

  const selectStockSwapToken = useCallback(
    (token: ISwapToken, options?: ISelectStockSwapTokenOptions) => {
      const nextStockToken = normalizeSelectedStockSwapToken(token);
      if (
        shouldResetStockTradeReceiveAmount({
          nextStockToken,
          previousStockToken: stockTokenSnapshotRef.current,
          resetReceiveAmount: options?.resetReceiveAmount,
        })
      ) {
        resetStockTradeReceiveAmount();
      }
      setStockTokenState(nextStockToken);
      setStockSelectedToken(nextStockToken);
      stockTokenSnapshotRef.current = nextStockToken;
      void syncStockExecutionTokens({
        stockToken: nextStockToken,
      });
    },
    [
      resetStockTradeReceiveAmount,
      setStockSelectedToken,
      syncStockExecutionTokens,
    ],
  );

  useEffect(() => {
    const handleSwapStockTokenSelected = (token: ISwapToken) => {
      if (!token?.networkId) {
        return;
      }
      defaultLogger.swap.selectToken.selectToken({
        selectFrom: ESwapSelectTokenSource.NORMAL_SELECT,
        tokenRole: SWAP_STOCK_ANALYTICS_TOKEN_ROLE_STOCK,
        tokenListType: SWAP_STOCK_ANALYTICS_TOKEN_LIST_TYPE_STOCK,
      });
      selectStockSwapToken(token, { resetReceiveAmount: true });
    };
    appEventBus.on(
      EAppEventBusNames.SwapStockTokenSelected,
      handleSwapStockTokenSelected,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.SwapStockTokenSelected,
        handleSwapStockTokenSelected,
      );
    };
  }, [selectStockSwapToken]);

  const {
    defaultStockTokenLoading,
    shouldLoadDefaultStockToken,
    stockCategoryType,
  } = useSwapStockDefaultToken({
    selectStockSwapToken,
    selectedStockTokenKey,
    spotCategories,
  });

  const stockMarketStatus = useMemo<
    IFetchUSMarketStatusResult | undefined
  >(() => {
    if (!activeStockTokenDetail?.stock) {
      return undefined;
    }
    const isOpen = activeStockTokenDetail.stock.isOpen;
    if (typeof isOpen !== 'boolean') {
      return {
        open: true,
        session: 'REGULAR',
        reason: activeStockTokenDetail.stock.description ?? null,
        unavailable: true,
      };
    }
    return {
      open: isOpen === true,
      session: isOpen === true ? 'REGULAR' : 'CLOSED',
      reason: activeStockTokenDetail.stock.description ?? null,
    };
  }, [activeStockTokenDetail?.stock]);

  const selectPayToken = useCallback(
    (token: IToken, manual = true) => {
      if (manual) {
        manualStockPayTokenKeyRef.current = getTokenIdentityKey(token);
        defaultLogger.swap.selectToken.selectToken({
          selectFrom: ESwapSelectTokenSource.NORMAL_SELECT,
          tokenRole: SWAP_STOCK_ANALYTICS_TOKEN_ROLE_PAY,
          tokenListType: SWAP_STOCK_ANALYTICS_TOKEN_LIST_TYPE_DEFAULT,
        });
      }
      const nextPayToken = token as ISwapToken;
      setPayTokenState(nextPayToken);
      payTokenSnapshotRef.current = nextPayToken;
      void syncStockExecutionTokens({
        payToken: nextPayToken,
      });
    },
    [syncStockExecutionTokens],
  );

  const syncPayTokenDetail = useCallback((token: IToken) => {
    // Detail-only refreshes should not rotate the Stock execution token sync id.
    const nextPayToken = token as ISwapToken;
    setPayTokenState(nextPayToken);
    payTokenSnapshotRef.current = nextPayToken;
  }, []);

  const {
    payTokenStatus,
    payTokenOptionsLoading,
    payTokens,
    selectablePayTokens,
    speedConfigReady,
  } = useSwapStockPayTokens({
    currentStockToken,
    currentStockTokenKey,
    disableNativePayToken,
    manualStockPayTokenKeyRef,
    payToken,
    selectPayToken,
    stockNetworkId,
    syncPayTokenDetail,
  });

  const selectStockToken = useCallback(
    (token: IMarketToken) => {
      const nextSwapToken = buildStockSwapTokenFromMarketToken(token);
      defaultLogger.swap.selectToken.selectToken({
        selectFrom: ESwapSelectTokenSource.NORMAL_SELECT,
        tokenRole: SWAP_STOCK_ANALYTICS_TOKEN_ROLE_STOCK,
        tokenListType: SWAP_STOCK_ANALYTICS_TOKEN_LIST_TYPE_STOCK,
      });
      selectStockSwapToken(nextSwapToken, { resetReceiveAmount: true });
    },
    [selectStockSwapToken],
  );

  const switchTradeSide = useCallback(
    async (nextTradeSide: ESwapStockTradeSide) => {
      if (nextTradeSide === tradeSide) {
        return;
      }
      const stockTokenForSwitch =
        stockTokenSnapshotRef.current ?? currentStockToken;
      const payTokenForSwitch = payTokenSnapshotRef.current ?? payToken;
      setTradeSideState(nextTradeSide);
      resetStockTradeAmounts();
      await syncStockExecutionTokens({
        nextTradeSide,
        stockToken: stockTokenForSwitch,
        payToken: payTokenForSwitch,
      });
    },
    [
      currentStockToken,
      payToken,
      resetStockTradeAmounts,
      syncStockExecutionTokens,
      tradeSide,
    ],
  );

  const selectRecentTokenPair = useCallback(
    async ({
      fromToken: pairFromToken,
      toToken: pairToToken,
    }: {
      fromToken: ISwapToken;
      toToken: ISwapToken;
    }) => {
      const isFromTokenPayToken =
        filterStockPayTokenCandidates([pairFromToken]).length > 0;
      const isToTokenPayToken =
        filterStockPayTokenCandidates([pairToToken]).length > 0;
      const shouldUseSellSide =
        Boolean(pairFromToken.isStock) ||
        (!isFromTokenPayToken && isToTokenPayToken);
      const nextTradeSide = shouldUseSellSide
        ? ESwapStockTradeSide.Sell
        : ESwapStockTradeSide.Buy;
      const nextStockToken = normalizeSelectedStockSwapToken(
        shouldUseSellSide ? pairFromToken : pairToToken,
      );
      const nextPayToken = shouldUseSellSide ? pairToToken : pairFromToken;

      resetStockTradeAmounts();
      setTradeSideState(nextTradeSide);
      setStockTokenState(nextStockToken);
      setStockSelectedToken(nextStockToken);
      stockTokenSnapshotRef.current = nextStockToken;
      manualStockPayTokenKeyRef.current = getTokenIdentityKey(nextPayToken);
      setPayTokenState(nextPayToken);
      payTokenSnapshotRef.current = nextPayToken;
      await syncStockExecutionTokens({
        nextTradeSide,
        stockToken: nextStockToken,
        payToken: nextPayToken,
      });
    },
    [resetStockTradeAmounts, setStockSelectedToken, syncStockExecutionTokens],
  );

  const stockTokenStatus = useMemo(() => {
    if (currentStockToken) {
      return ESwapStockChannelAsyncStatus.Ready;
    }
    if (shouldLoadDefaultStockToken && defaultStockTokenLoading) {
      return ESwapStockChannelAsyncStatus.Initializing;
    }
    if (!stockCategoryType) {
      return ESwapStockChannelAsyncStatus.Initializing;
    }
    return ESwapStockChannelAsyncStatus.Empty;
  }, [
    currentStockToken,
    defaultStockTokenLoading,
    shouldLoadDefaultStockToken,
    stockCategoryType,
  ]);

  const marketStatusStatus = useMemo(() => {
    if (!currentStockTokenKey) {
      return ESwapStockChannelAsyncStatus.Idle;
    }
    if (!activeStockTokenDetail?.stock) {
      // Initializing only until the FIRST result for the current token scope
      // lands (pending). Per-request loading is deliberately excluded: the
      // 10s detail polling would otherwise flip this status on every tick
      // while the detail stays empty (e.g. offline), blinking the
      // unavailable alert and the action button.
      return stockTokenDetailPending
        ? ESwapStockChannelAsyncStatus.Initializing
        : ESwapStockChannelAsyncStatus.Empty;
    }
    if (stockMarketStatus) {
      return ESwapStockChannelAsyncStatus.Ready;
    }
    return ESwapStockChannelAsyncStatus.Empty;
  }, [
    currentStockTokenKey,
    activeStockTokenDetail?.stock,
    stockMarketStatus,
    stockTokenDetailPending,
  ]);

  const channelStage = useMemo(() => {
    if (stockTokenStatus === ESwapStockChannelAsyncStatus.Initializing) {
      return ESwapStockChannelStage.InitializingStock;
    }
    if (stockTokenStatus !== ESwapStockChannelAsyncStatus.Ready) {
      return ESwapStockChannelStage.MissingStock;
    }
    if (marketStatusStatus === ESwapStockChannelAsyncStatus.Initializing) {
      return ESwapStockChannelStage.CheckingMarketStatus;
    }
    if (
      marketStatusStatus !== ESwapStockChannelAsyncStatus.Ready ||
      stockMarketStatus?.unavailable
    ) {
      return ESwapStockChannelStage.MarketUnavailable;
    }
    if (stockMarketStatus?.open === false) {
      return ESwapStockChannelStage.MarketClosed;
    }
    if (payTokenStatus === ESwapStockChannelAsyncStatus.Initializing) {
      return ESwapStockChannelStage.InitializingPayToken;
    }
    if (payTokenStatus !== ESwapStockChannelAsyncStatus.Ready) {
      return ESwapStockChannelStage.MissingPayToken;
    }
    return ESwapStockChannelStage.Ready;
  }, [
    marketStatusStatus,
    payTokenStatus,
    stockMarketStatus?.open,
    stockMarketStatus?.unavailable,
    stockTokenStatus,
  ]);

  const readyForQuote =
    channelStage === ESwapStockChannelStage.Ready &&
    !!payToken &&
    !!currentStockToken;

  useEffect(() => {
    if (!readyForQuote) {
      return;
    }

    const {
      fromToken: stockExecutionFromToken,
      toToken: stockExecutionToToken,
    } = buildStockExecutionTokens({
      payToken,
      stockToken: currentStockToken,
      tradeSide,
    });
    const executionPairSynced = Boolean(
      stockExecutionFromToken &&
      stockExecutionToToken &&
      equalTokenNoCaseSensitive({
        token1: fromToken,
        token2: stockExecutionFromToken,
      }) &&
      equalTokenNoCaseSensitive({
        token1: toToken,
        token2: stockExecutionToToken,
      }),
    );
    if (executionPairSynced) {
      return;
    }

    void syncStockExecutionTokens({
      payToken,
      stockToken: currentStockToken,
    });
  }, [
    currentStockToken,
    payToken,
    readyForQuote,
    syncStockExecutionTokens,
    tradeSide,
    fromToken,
    toToken,
  ]);

  return useMemo(
    () => ({
      stockTokenStatus,
      marketStatusStatus,
      payTokenStatus,
      channelStage,
      readyForQuote,
      tradeSide,
      stockNetworkId,
      stockMarketStatus,
      stockPerpsInfo,
      activeStockTokenDetail,
      realtimeChartPoint,
      currentStockToken,
      payToken,
      fromToken,
      toToken,
      payTokens,
      selectablePayTokens,
      defaultStockTokenLoading: !!defaultStockTokenLoading,
      payTokenOptionsLoading: !!payTokenOptionsLoading,
      speedConfigReady,
      disableNativePayToken: !!disableNativePayToken,
      selectStockSwapToken,
      selectStockToken,
      selectPayToken,
      switchTradeSide,
      selectRecentTokenPair,
    }),
    [
      channelStage,
      currentStockToken,
      defaultStockTokenLoading,
      fromToken,
      marketStatusStatus,
      payToken,
      payTokenOptionsLoading,
      payTokenStatus,
      payTokens,
      readyForQuote,
      realtimeChartPoint,
      selectablePayTokens,
      selectPayToken,
      selectRecentTokenPair,
      selectStockSwapToken,
      selectStockToken,
      switchTradeSide,
      speedConfigReady,
      activeStockTokenDetail,
      stockMarketStatus,
      stockNetworkId,
      stockPerpsInfo,
      stockTokenStatus,
      toToken,
      tradeSide,
      disableNativePayToken,
    ],
  );
}

export type IUseSwapStockChannelReturn = ReturnType<typeof useSwapStockChannel>;
