import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
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
  IMarketPerpsInfo,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/marketV2';
import type {
  IFetchUSMarketStatusResult,
  IMarketPresetTokenContext,
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
  buildStockSwapTokenFromMarketDetail,
  buildStockSwapTokenFromMarketToken,
  buildStockSwapTokenFromTokenIdentity,
  filterStockPayTokenCandidates,
  getMarketPresetTokenKey,
  getTokenIdentityKey,
  isCurrentStockMarketDetail,
  resolveStockChannelToken,
} from './swapStockChannelUtils';
import { useSwapStockDefaultToken } from './useSwapStockDefaultToken';
import { useSwapStockPayTokens } from './useSwapStockPayTokens';

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

type IStockTokenDetailState = {
  perpsInfo?: IMarketPerpsInfo;
  tokenDetail?: IMarketTokenDetail;
  tokenKey: string;
};

export function useSwapStockChannel({
  marketPresetToken,
}: {
  marketPresetToken?: IMarketPresetTokenContext;
}) {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setToTokenAmount] = useSwapToTokenAmountAtom();
  const { selectStockExecutionTokens } = useSwapActions().current;
  const { spotCategories } = useMarketBasicConfig();
  const [tradeSide, setTradeSide] = useState(ESwapStockTradeSide.Buy);
  const [stockTokenState, setStockTokenState] = useState<
    ISwapToken | undefined
  >(undefined);
  const [payTokenState, setPayTokenState] = useState<ISwapToken | undefined>(
    undefined,
  );
  const manualStockPayTokenKeyRef = useRef('');
  const stockTokenSnapshotRef = useRef<ISwapToken | undefined>(undefined);
  const payTokenSnapshotRef = useRef<ISwapToken | undefined>(undefined);

  const isBuySide = tradeSide === ESwapStockTradeSide.Buy;
  const marketPresetTokenKey = getMarketPresetTokenKey(marketPresetToken);
  const stockDetailRequestToken = useMemo(
    () => stockTokenState ?? marketPresetToken,
    [marketPresetToken, stockTokenState],
  );
  const stockDetailRequestTokenKey = getTokenIdentityKey(
    stockDetailRequestToken,
  );
  const { result: stockDetailState } = usePromiseResult(
    async (): Promise<IStockTokenDetailState> => {
      if (
        !stockDetailRequestToken?.networkId ||
        !stockDetailRequestTokenKey ||
        (!stockDetailRequestToken.contractAddress &&
          !stockDetailRequestToken.isNative)
      ) {
        return {
          perpsInfo: undefined,
          tokenDetail: undefined,
          tokenKey: stockDetailRequestTokenKey,
        };
      }
      try {
        const response =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenDetailByTokenAddress(
            stockDetailRequestToken.contractAddress ?? '',
            stockDetailRequestToken.networkId,
            { autoHandleError: false },
          );
        return {
          perpsInfo: response?.data.perpsInfo,
          tokenDetail: response?.data.token,
          tokenKey: stockDetailRequestTokenKey,
        };
      } catch {
        return {
          perpsInfo: undefined,
          tokenDetail: undefined,
          tokenKey: stockDetailRequestTokenKey,
        };
      }
    },
    [
      stockDetailRequestToken?.contractAddress,
      stockDetailRequestToken?.isNative,
      stockDetailRequestToken?.networkId,
      stockDetailRequestTokenKey,
    ],
    {
      initResult: {
        perpsInfo: undefined,
        tokenDetail: undefined,
        tokenKey: '',
      },
      watchLoading: !!stockDetailRequestTokenKey,
      pollingInterval: stockDetailRequestTokenKey ? 6000 : undefined,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      checkIsFocused: false,
    },
  );
  const fetchedStockTokenDetail =
    stockDetailState.tokenKey === stockDetailRequestTokenKey &&
    isCurrentStockMarketDetail({
      currentStockToken: stockDetailRequestToken,
      isNative: stockDetailRequestToken?.isNative,
      networkId: stockDetailRequestToken?.networkId,
      tokenAddress: stockDetailRequestToken?.contractAddress,
      tokenDetail: stockDetailState.tokenDetail,
    })
      ? stockDetailState.tokenDetail
      : undefined;
  const fetchedStockToken = useMemo(
    () =>
      fetchedStockTokenDetail
        ? buildStockSwapTokenFromMarketDetail({
            tokenDetail: fetchedStockTokenDetail,
            tokenAddress: stockDetailRequestToken?.contractAddress,
            networkId: stockDetailRequestToken?.networkId,
            isNative: stockDetailRequestToken?.isNative,
          })
        : undefined,
    [
      fetchedStockTokenDetail,
      stockDetailRequestToken?.contractAddress,
      stockDetailRequestToken?.isNative,
      stockDetailRequestToken?.networkId,
    ],
  );
  const fallbackStockToken = useMemo(() => {
    if (!stockDetailRequestTokenKey) {
      return undefined;
    }
    const snapshotStockToken = stockTokenSnapshotRef.current;
    if (
      getTokenIdentityKey(snapshotStockToken) === stockDetailRequestTokenKey
    ) {
      return snapshotStockToken;
    }
    return buildStockSwapTokenFromTokenIdentity(stockDetailRequestToken);
  }, [stockDetailRequestToken, stockDetailRequestTokenKey]);
  const swapPairPayToken = isBuySide ? fromToken : toToken;
  const selectedStockToken = resolveStockChannelToken({
    fallbackStockToken,
    stockTokenState,
    marketStockToken: fetchedStockToken,
  });
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
  const payToken = payTokenState ?? swapPairStockPayToken;
  const stockNetworkId = currentStockToken?.networkId ?? '';
  const activeStockTokenDetail =
    fetchedStockTokenDetail &&
    isCurrentStockMarketDetail({
      currentStockToken,
      isNative: currentStockToken?.isNative,
      networkId: currentStockToken?.networkId,
      tokenAddress: currentStockToken?.contractAddress,
      tokenDetail: fetchedStockTokenDetail,
    })
      ? fetchedStockTokenDetail
      : undefined;
  const activeStockPerpsInfo = activeStockTokenDetail
    ? stockDetailState.perpsInfo
    : undefined;
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
      const nextFromToken =
        nextTradeSide === ESwapStockTradeSide.Buy ? nextPayToken : stockToken;
      const nextToToken =
        nextTradeSide === ESwapStockTradeSide.Buy ? stockToken : nextPayToken;

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

  const selectStockSwapToken = useCallback(
    (
      token: ISwapToken,
      options?: {
        resetAmounts?: boolean;
      },
    ) => {
      const previousStockTokenKey = getTokenIdentityKey(
        stockTokenSnapshotRef.current,
      );
      const nextStockTokenKey = getTokenIdentityKey(token);
      if (
        options?.resetAmounts &&
        previousStockTokenKey &&
        nextStockTokenKey &&
        previousStockTokenKey !== nextStockTokenKey
      ) {
        resetStockTradeAmounts();
      }
      setStockTokenState(token);
      stockTokenSnapshotRef.current = token;
      void syncStockExecutionTokens({
        stockToken: token,
      });
    },
    [resetStockTradeAmounts, syncStockExecutionTokens],
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
      selectStockSwapToken(token, { resetAmounts: true });
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
    marketPresetTokenKey,
    marketStockToken: fetchedStockToken,
    selectStockSwapToken,
    selectedStockTokenKey,
    spotCategories,
    tokenDetailHasStock: !!fetchedStockToken,
  });

  const stockMarketStatus = useMemo<
    IFetchUSMarketStatusResult | undefined
  >(() => {
    const stock = activeStockTokenDetail?.stock;
    if (!stock) {
      return undefined;
    }
    const isOpen = stock.isOpen;
    return {
      open: isOpen === true,
      session: isOpen === true ? 'REGULAR' : 'CLOSED',
      reason: stock.description ?? null,
      unavailable: typeof isOpen === 'boolean' ? undefined : true,
    };
  }, [activeStockTokenDetail?.stock]);
  const stockMarketStatusOpen = stockMarketStatus?.open === true;

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
      selectStockSwapToken(nextSwapToken, { resetAmounts: true });
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
      setTradeSide(nextTradeSide);
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
      const nextStockToken = shouldUseSellSide ? pairFromToken : pairToToken;
      const nextPayToken = shouldUseSellSide ? pairToToken : pairFromToken;

      resetStockTradeAmounts();
      setTradeSide(nextTradeSide);
      setStockTokenState(nextStockToken);
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
    [resetStockTradeAmounts, syncStockExecutionTokens],
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
      return ESwapStockChannelAsyncStatus.Initializing;
    }
    if (stockMarketStatus) {
      return ESwapStockChannelAsyncStatus.Ready;
    }
    return ESwapStockChannelAsyncStatus.Empty;
  }, [activeStockTokenDetail?.stock, currentStockTokenKey, stockMarketStatus]);

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
    if (stockMarketStatus?.unavailable) {
      return ESwapStockChannelStage.MarketUnavailable;
    }
    if (!stockMarketStatusOpen) {
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
    stockMarketStatus?.unavailable,
    stockMarketStatusOpen,
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
      activeStockPerpsInfo,
      activeStockTokenDetail,
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
      selectablePayTokens,
      selectPayToken,
      selectRecentTokenPair,
      selectStockToken,
      switchTradeSide,
      speedConfigReady,
      stockMarketStatus,
      activeStockPerpsInfo,
      activeStockTokenDetail,
      stockNetworkId,
      stockTokenStatus,
      toToken,
      tradeSide,
      disableNativePayToken,
    ],
  );
}

export type IUseSwapStockChannelReturn = ReturnType<typeof useSwapStockChannel>;
