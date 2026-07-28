import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapInputAmountSnapshotsAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapStockExecutionTokenSyncIdAtom,
  useSwapStockExecutionTokensAtom,
  useSwapStockQuoteReadyAtom,
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
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IFetchUSMarketStatusResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapSelectTokenSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

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
  canActivateStockExecutionOwnership,
  canResolveStockInputAmountSnapshot,
  filterStockPayTokenCandidates,
  getTokenIdentityKey,
  isSameStockPayTokenIdentity,
  isStockExecutionTokensReady,
  isStockTradeReadyForQuote,
  resolveStockChannelSwapPair,
  resolveStockMarketDetailAuthority,
  resolveStockMarketStatusStatus,
  resolveStockPayTokenForCommittedOwner,
  shouldResetStockPayTokenInputAmount,
  shouldResetStockTradeReceiveAmount,
  shouldSyncStockExecutionState,
} from './swapStockChannelUtils';
import { usePublishSwapStockQuoteReadiness } from './usePublishSwapStockQuoteReadiness';
import {
  getSwapColdStartDisplayTokensFromGlobalSnapshot,
  getSwapStockColdStartDisplayTokenFromGlobalSnapshot,
} from './useSwapColdStartDisplayTokens';
import { useSwapStockDefaultToken } from './useSwapStockDefaultToken';
import { useSwapStockMarketWebSocket } from './useSwapStockMarketWebSocket';
import { useSwapStockPayTokens } from './useSwapStockPayTokens';
import { useSwapStockTokenDetail } from './useSwapStockTokenDetail';

export {
  ESwapStockChannelAsyncStatus,
  ESwapStockChannelStage,
  ESwapStockTradeSide,
} from './swapStockChannelUtils';

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
  const [stockExecutionTokenSyncId] = useSwapStockExecutionTokenSyncIdAtom();
  const [stockExecutionTokens] = useSwapStockExecutionTokensAtom();
  const [, setStockQuoteReady] = useSwapStockQuoteReadyAtom();
  const [inputAmountSnapshots] = useSwapInputAmountSnapshotsAtom();
  const [stockSelectedToken, setStockSelectedToken] =
    useSwapStockSelectedTokenAtom();
  const [, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setToTokenAmount] = useSwapToTokenAmountAtom();
  const { resetQuoteAction, selectStockExecutionTokens } =
    useSwapActions().current;
  const { spotCategories, isLoading: marketBasicConfigLoading } =
    useMarketBasicConfig();
  const [tradeSideState, setTradeSideState] = useState<
    ESwapStockTradeSide | undefined
  >(undefined);
  const [stockTokenState, setStockTokenState] = useState<
    ISwapToken | undefined
  >(undefined);
  const [payTokenState, setPayTokenState] = useState<ISwapToken | undefined>(
    undefined,
  );
  const [stockQuoteReadinessEpoch, setStockQuoteReadinessEpoch] = useState(0);
  const manualStockPayTokenKeyRef = useRef('');
  const stockTokenSnapshotRef = useRef<ISwapToken | undefined>(undefined);
  const payTokenSnapshotRef = useRef<ISwapToken | undefined>(undefined);
  const stockQuoteReadyRef = useRef(false);

  const deactivateStockQuote = useCallback(() => {
    stockQuoteReadyRef.current = false;
    setStockQuoteReady(false);
    setStockQuoteReadinessEpoch((value) => value + 1);
    void resetQuoteAction();
  }, [resetQuoteAction, setStockQuoteReady]);

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
  const coldStartStockPairRef = useRef<
    | {
        payToken?: ISwapToken;
        stockToken?: ISwapToken;
        tradeSide?: ESwapStockTradeSide;
      }
    | undefined
  >(undefined);
  if (!coldStartStockPairRef.current) {
    const coldStartDisplayTokens =
      getSwapColdStartDisplayTokensFromGlobalSnapshot();
    const coldStartExecutionPair = resolveStockChannelSwapPair({
      fromToken: coldStartDisplayTokens.fromToken,
      toToken: coldStartDisplayTokens.toToken,
    });
    const coldStartStockToken =
      getSwapStockColdStartDisplayTokenFromGlobalSnapshot() ??
      coldStartExecutionPair.stockToken;
    const isExecutionPairForDisplayToken = Boolean(
      !coldStartStockToken ||
      getTokenIdentityKey(coldStartStockToken) ===
        getTokenIdentityKey(coldStartExecutionPair.stockToken),
    );
    coldStartStockPairRef.current = {
      payToken: isExecutionPairForDisplayToken
        ? coldStartExecutionPair.payToken
        : undefined,
      stockToken: coldStartStockToken,
      tradeSide: isExecutionPairForDisplayToken
        ? coldStartExecutionPair.tradeSide
        : undefined,
    };
  }
  const coldStartStockPair = coldStartStockPairRef.current;
  const hasStockExecutionPair = Boolean(
    executionTokensStockPair.stockToken ?? executionTokensStockPair.payToken,
  );
  const stockPair = hasStockExecutionPair
    ? executionTokensStockPair
    : selectedTokensStockPair;
  const tradeSide =
    tradeSideState ??
    stockPair.tradeSide ??
    coldStartStockPair.tradeSide ??
    ESwapStockTradeSide.Buy;
  const isBuySide = tradeSide === ESwapStockTradeSide.Buy;
  const swapPairPayToken = isBuySide ? fromToken : toToken;
  const persistedStockSelectedToken = stockSelectedToken?.isStock
    ? stockSelectedToken
    : undefined;
  const selectedStockToken =
    stockTokenState ??
    persistedStockSelectedToken ??
    stockPair.stockToken ??
    coldStartStockPair.stockToken;
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
  const coldStartStockPairPayToken =
    coldStartStockPair.tradeSide === tradeSide
      ? coldStartStockPair.payToken
      : undefined;
  const selectedPayToken =
    payTokenState ??
    stockPairPayToken ??
    swapPairStockPayToken ??
    coldStartStockPairPayToken;
  const stockNetworkId = currentStockToken?.networkId ?? '';
  const {
    displayTokenDetail: cachedStockTokenDetail,
    fetchedAt: stockMarketDetailFetchedAt,
    latestFetchSucceeded: stockMarketDetailFetchSucceeded,
    pending: stockTokenDetailPending,
    perpsInfo: stockPerpsInfo,
    tokenDetail: stockTokenDetail,
  } = useSwapStockTokenDetail({
    requireCurrentActivation: true,
    token: currentStockToken,
  });
  const { realtimeChartPoint, realtimeTokenDetail: activeStockTokenDetail } =
    useSwapStockMarketWebSocket({
      currentStockToken,
      enabled: !!currentStockTokenKey,
      tokenDetail: stockTokenDetail,
    });
  const displayStockTokenDetail =
    activeStockTokenDetail ?? cachedStockTokenDetail;
  const currentStockMarketDetail = resolveStockMarketDetailAuthority({
    currentActivationPending: stockTokenDetailPending,
    realtimeTokenDetail: activeStockTokenDetail,
  });
  const stockMarketPaused = currentStockMarketDetail?.stock?.isPaused;
  const disableNativePayToken = isOndoStockSource(
    activeStockTokenDetail?.stock?.source,
  );

  const syncStockExecutionTokens = useCallback(
    async ({
      nextTradeSide = tradeSide,
      stockToken = stockTokenSnapshotRef.current ?? currentStockToken,
      payToken: nextPayToken = payTokenSnapshotRef.current ?? selectedPayToken,
      resolveInputSnapshot = false,
    }: {
      nextTradeSide?: ESwapStockTradeSide;
      stockToken?: ISwapToken;
      payToken?: ISwapToken;
      resolveInputSnapshot?: boolean;
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
        resolveInputSnapshot,
        toToken: nextToToken,
        syncId: nextStockExecutionTokenSyncId(),
      });
    },
    [
      currentStockToken,
      selectStockExecutionTokens,
      selectedPayToken,
      tradeSide,
    ],
  );

  useEffect(() => {
    if (currentStockToken) {
      stockTokenSnapshotRef.current = currentStockToken;
    }
  }, [currentStockToken]);

  useEffect(() => {
    if (!stockSelectedToken && coldStartStockPair.stockToken) {
      setStockSelectedToken(coldStartStockPair.stockToken);
    }
  }, [
    coldStartStockPair.stockToken,
    setStockSelectedToken,
    stockSelectedToken,
  ]);

  useEffect(() => {
    if (selectedPayToken) {
      payTokenSnapshotRef.current = selectedPayToken;
    }
  }, [selectedPayToken]);

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
      const previousStockToken = stockTokenSnapshotRef.current;
      if (
        getTokenIdentityKey(previousStockToken) !==
        getTokenIdentityKey(nextStockToken)
      ) {
        deactivateStockQuote();
      }
      if (
        shouldResetStockTradeReceiveAmount({
          nextStockToken,
          previousStockToken,
          resetReceiveAmount: options?.resetReceiveAmount,
        })
      ) {
        resetStockTradeReceiveAmount();
      }
      setStockTokenState(nextStockToken);
      setStockSelectedToken(nextStockToken);
      stockTokenSnapshotRef.current = nextStockToken;
    },
    [deactivateStockQuote, resetStockTradeReceiveAmount, setStockSelectedToken],
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
    defaultStockTokenStatus,
    shouldLoadDefaultStockToken,
  } = useSwapStockDefaultToken({
    marketBasicConfigLoading,
    selectStockSwapToken,
    selectedStockTokenKey,
    spotCategories,
  });

  const stockMarketStatus = useMemo<
    IFetchUSMarketStatusResult | undefined
  >(() => {
    if (!currentStockMarketDetail?.stock) {
      return undefined;
    }
    const isOpen = currentStockMarketDetail.stock.isOpen;
    return {
      // Only an explicit close blocks trading. Pre/post/overnight sessions and
      // fresh detail without an isOpen flag remain eligible for quote requests.
      open: isOpen !== false,
      session: isOpen === false ? 'CLOSED' : 'REGULAR',
      reason: currentStockMarketDetail.stock.description ?? null,
    };
  }, [currentStockMarketDetail?.stock]);

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
      const previousPayToken = payTokenSnapshotRef.current ?? selectedPayToken;
      if (
        previousPayToken &&
        !isSameStockPayTokenIdentity({
          token1: previousPayToken,
          token2: nextPayToken,
        })
      ) {
        deactivateStockQuote();
      }
      if (
        shouldResetStockPayTokenInputAmount({
          nextPayToken,
          previousPayToken,
          tradeSide,
        })
      ) {
        resetStockTradeAmounts();
      } else if (
        previousPayToken &&
        !isSameStockPayTokenIdentity({
          token1: previousPayToken,
          token2: nextPayToken,
        })
      ) {
        resetStockTradeReceiveAmount();
      }
      setPayTokenState(nextPayToken);
      payTokenSnapshotRef.current = nextPayToken;
    },
    [
      resetStockTradeAmounts,
      resetStockTradeReceiveAmount,
      selectedPayToken,
      deactivateStockQuote,
      tradeSide,
    ],
  );

  const syncPayTokenDetail = useCallback((token: IToken) => {
    // Detail-only refreshes should not rotate the Stock execution token sync id.
    const nextPayToken = token as ISwapToken;
    setPayTokenState(nextPayToken);
    payTokenSnapshotRef.current = nextPayToken;
  }, []);

  const {
    displayPayToken,
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
    payToken: selectedPayToken,
    selectPayToken,
    stockNetworkId,
    syncPayTokenDetail,
  });
  const payToken = resolveStockPayTokenForCommittedOwner({
    displayPayToken,
    selectedPayToken,
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
      deactivateStockQuote();
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
      deactivateStockQuote,
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
      const stockScopeChanged =
        nextTradeSide !== tradeSide ||
        getTokenIdentityKey(nextStockToken) !==
          getTokenIdentityKey(
            stockTokenSnapshotRef.current ?? currentStockToken,
          ) ||
        getTokenIdentityKey(nextPayToken) !==
          getTokenIdentityKey(payTokenSnapshotRef.current ?? payToken);

      if (stockScopeChanged) {
        deactivateStockQuote();
      }
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
    [
      deactivateStockQuote,
      currentStockToken,
      payToken,
      resetStockTradeAmounts,
      setStockSelectedToken,
      syncStockExecutionTokens,
      tradeSide,
    ],
  );

  const stockTokenStatus = useMemo(() => {
    if (currentStockToken) {
      return ESwapStockChannelAsyncStatus.Ready;
    }
    if (shouldLoadDefaultStockToken) {
      return defaultStockTokenStatus;
    }
    return ESwapStockChannelAsyncStatus.Empty;
  }, [currentStockToken, defaultStockTokenStatus, shouldLoadDefaultStockToken]);

  // Only an explicit closed/paused state restricts Stock trading. Once the
  // initial status request settles, missing fields and request failures must
  // fail open while the independent quote contract remains authoritative.
  const marketStatusStatus = resolveStockMarketStatusStatus({
    currentActivationPending: stockTokenDetailPending,
    hasCurrentStockToken: Boolean(currentStockTokenKey),
  });

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
    if (marketStatusStatus !== ESwapStockChannelAsyncStatus.Ready) {
      return ESwapStockChannelStage.MarketUnavailable;
    }
    if (stockMarketPaused) {
      return ESwapStockChannelStage.MarketPaused;
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
    stockMarketPaused,
    stockTokenStatus,
  ]);

  const readyForQuote = isStockTradeReadyForQuote({
    currentStockToken,
    marketOpen: stockMarketStatus?.open,
    marketPaused: stockMarketPaused,
    marketStatusStatus,
    payToken,
    payTokenStatus,
    stockTokenStatus,
  });
  usePublishSwapStockQuoteReadiness({
    readinessEpoch: stockQuoteReadinessEpoch,
    readyForQuote,
    readyForQuoteRef: stockQuoteReadyRef,
    resetQuote: resetQuoteAction,
    setReadyForQuote: setStockQuoteReady,
  });

  useEffect(() => {
    if (
      !canActivateStockExecutionOwnership({
        marketStatusStatus,
        payTokenStatus,
        stockTokenStatus,
      })
    ) {
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
    // Execution-pair ownership and draft restoration must not depend on quote
    // readiness: the pair remains authoritative while the market is closed.
    if (!stockExecutionFromToken || !stockExecutionToToken) {
      return;
    }
    const selectedPairSynced =
      equalTokenNoCaseSensitive({
        token1: fromToken,
        token2: stockExecutionFromToken,
      }) &&
      equalTokenNoCaseSensitive({
        token1: toToken,
        token2: stockExecutionToToken,
      });
    const executionOwnershipSynced = isStockExecutionTokensReady({
      currentSyncId: stockExecutionTokenSyncId,
      executionTokens: stockExecutionTokens,
      fromToken: stockExecutionFromToken,
      toToken: stockExecutionToToken,
    });
    const canResolvePendingInputSnapshot = canResolveStockInputAmountSnapshot({
      marketStatusStatus,
      payTokenStatus,
      stockTokenStatus,
    });
    if (
      !shouldSyncStockExecutionState({
        executionOwnershipSynced,
        hasPendingInputSnapshot: Boolean(
          canResolvePendingInputSnapshot &&
          inputAmountSnapshots[ESwapTabSwitchType.STOCK],
        ),
        selectedPairSynced,
      })
    ) {
      return;
    }

    void syncStockExecutionTokens({
      payToken,
      resolveInputSnapshot: canResolvePendingInputSnapshot,
      stockToken: currentStockToken,
    });
  }, [
    currentStockToken,
    inputAmountSnapshots,
    marketStatusStatus,
    payToken,
    payTokenStatus,
    syncStockExecutionTokens,
    stockExecutionTokenSyncId,
    stockExecutionTokens,
    stockTokenStatus,
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
      stockMarketDetailFetchedAt,
      stockMarketDetailFetchSucceeded,
      stockMarketPaused,
      stockPerpsInfo,
      activeStockTokenDetail,
      displayStockTokenDetail,
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
      displayStockTokenDetail,
      stockMarketStatus,
      stockMarketDetailFetchedAt,
      stockMarketDetailFetchSucceeded,
      stockMarketPaused,
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
