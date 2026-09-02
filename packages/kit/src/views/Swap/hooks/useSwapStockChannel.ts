import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
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
import type {
  IFetchUSMarketStatusResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapSelectTokenSource } from '@onekeyhq/shared/types/swap/types';

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
  isStockTradeReadyForQuote,
  resolveStockChannelSwapPair,
  resolveStockExecutionTokenMetadata,
  resolveStockExecutionTokensForTradeSideSwitch,
  resolveStockExecutionTokensToSync,
  resolveStockPayTokenState,
  shouldResetStockTradeReceiveAmount,
} from './swapStockChannelUtils';
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

function normalizeSelectedStockSwapToken(token: ISwapToken) {
  return token.isStock ? token : { ...token, isStock: true };
}

type ISelectStockSwapTokenOptions = {
  resetReceiveAmount?: boolean;
};

export function useSwapStockChannel() {
  const locale = useLocaleVariant().toLowerCase();
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [stockExecutionTokens] = useSwapStockExecutionTokensAtom();
  const [stockSelectedToken, setStockSelectedToken] =
    useSwapStockSelectedTokenAtom();
  const [, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setToTokenAmount] = useSwapToTokenAmountAtom();
  const { selectStockExecutionTokens } = useSwapActions().current;
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
  const manualStockPayTokenKeyRef = useRef('');
  const stockTokenSnapshotRef = useRef<ISwapToken | undefined>(undefined);
  const payTokenSnapshotRef = useRef<ISwapToken | undefined>(undefined);
  // Token-selector metadata is already localized. Keep its locale separate
  // from the persisted token so a cold-start snapshot cannot flash old copy.
  const stockTokenMetadataLocaleRef = useRef<string | undefined>(undefined);

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
  const payTokenStateParams = {
    channelToken: payTokenState,
    coldStartToken: coldStartStockPairPayToken,
    stockPairToken: stockPairPayToken,
    swapPairToken: swapPairStockPayToken,
  };
  const {
    displayToken: stockOwnedPayToken,
    selectionToken: payTokenSelectionSeed,
  } = resolveStockPayTokenState(payTokenStateParams);
  const stockNetworkId = currentStockToken?.networkId ?? '';
  const {
    displayTokenDetail: cachedStockTokenDetail,
    pending: stockTokenDetailPending,
    perpsInfo: stockPerpsInfo,
    tokenDetail: stockTokenDetail,
  } = useSwapStockTokenDetail({
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
  const disableNativePayToken = isOndoStockSource(
    activeStockTokenDetail?.stock?.source,
  );

  const syncStockExecutionTokens = useCallback(
    async ({
      nextTradeSide = tradeSide,
      stockToken = stockTokenSnapshotRef.current ?? currentStockToken,
      payToken: nextPayToken = payTokenSnapshotRef.current ??
        stockOwnedPayToken,
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
    [
      currentStockToken,
      selectStockExecutionTokens,
      stockOwnedPayToken,
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
      stockTokenMetadataLocaleRef.current = localeRef.current;
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

  const syncStockTokenDetail = useCallback(
    (tokenDetail: ISwapToken) => {
      const currentToken = stockTokenSnapshotRef.current ?? currentStockToken;
      const nextStockToken = resolveStockExecutionTokenMetadata({
        token: currentToken,
        tokenDetail,
      });
      if (!nextStockToken || nextStockToken === currentToken) {
        return;
      }
      stockTokenMetadataLocaleRef.current = localeRef.current;
      setStockTokenState(nextStockToken);
      setStockSelectedToken(nextStockToken);
      stockTokenSnapshotRef.current = nextStockToken;
      void syncStockExecutionTokens({
        stockToken: nextStockToken,
      });
    },
    [currentStockToken, setStockSelectedToken, syncStockExecutionTokens],
  );

  useEffect(() => {
    const detail = stockTokenDetail;
    const currentSubtitle = currentStockToken?.stock?.subtitle?.trim();
    const detailSubtitle = detail?.stock?.subtitle?.trim();
    // Detail is authoritative after a locale change; keep the selected token
    // and its execution snapshot aligned with the current-language metadata.
    if (
      !currentStockToken ||
      !detail ||
      !detailSubtitle ||
      currentSubtitle === detailSubtitle
    ) {
      return;
    }
    syncStockTokenDetail({
      ...currentStockToken,
      decimals: detail.decimals,
      isNative: detail.isNative ?? currentStockToken.isNative,
      isStock: true,
      stock: detail.stock,
    });
  }, [currentStockToken, stockTokenDetail, syncStockTokenDetail]);

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
    payToken: payTokenSelectionSeed,
    selectPayToken,
    stockNetworkId,
    syncPayTokenDetail,
  });
  const { displayToken: payToken } = resolveStockPayTokenState({
    ...payTokenStateParams,
    liveToken: displayPayToken,
  });

  useEffect(() => {
    if (payToken) {
      payTokenSnapshotRef.current = payToken;
    }
  }, [payToken]);

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
      const executionTokensForSwitch =
        resolveStockExecutionTokensForTradeSideSwitch({
          stockToken: stockTokenSnapshotRef.current ?? currentStockToken,
          payToken: payTokenSnapshotRef.current ?? payToken,
        });
      setTradeSideState(nextTradeSide);
      resetStockTradeAmounts();
      if (!executionTokensForSwitch) {
        return;
      }
      await syncStockExecutionTokens({
        nextTradeSide,
        ...executionTokensForSwitch,
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
      stockTokenMetadataLocaleRef.current = localeRef.current;
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
    if (shouldLoadDefaultStockToken) {
      return defaultStockTokenStatus;
    }
    return ESwapStockChannelAsyncStatus.Empty;
  }, [currentStockToken, defaultStockTokenStatus, shouldLoadDefaultStockToken]);

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
    // A closed market is NOT a blocking stage (OK-58986): quoting proceeds
    // and providers decide whether the token still trades.
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
    stockMarketStatus?.unavailable,
    stockTokenStatus,
  ]);

  const readyForQuote = isStockTradeReadyForQuote({
    currentStockToken,
    marketStatusStatus,
    payToken,
    payTokenStatus,
    stockTokenStatus,
  });

  const hasCurrentLocaleStockMetadata =
    stockTokenMetadataLocaleRef.current === locale;

  useEffect(() => {
    const executionTokensToSync = resolveStockExecutionTokensToSync({
      currentFromToken: fromToken,
      currentToToken: toToken,
      payToken,
      readyForQuote,
      stockToken: currentStockToken,
      tradeSide,
    });
    if (!executionTokensToSync) {
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
      displayStockTokenDetail,
      realtimeChartPoint,
      currentStockToken,
      hasCurrentLocaleStockMetadata,
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
      syncStockTokenDetail,
    }),
    [
      channelStage,
      currentStockToken,
      hasCurrentLocaleStockMetadata,
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
      syncStockTokenDetail,
      switchTradeSide,
      speedConfigReady,
      activeStockTokenDetail,
      displayStockTokenDetail,
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
