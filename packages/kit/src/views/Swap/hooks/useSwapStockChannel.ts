import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapToTokenAmountAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import { useTokenDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useTokenDetail';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IFetchUSMarketStatusResult,
  IMarketPresetTokenContext,
  ISwapToken,
  ISwapTokenBase,
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
  filterStockPayTokenCandidates,
  getMarketPresetTokenKey,
  getTokenIdentityKey,
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

export function useSwapStockChannel({
  marketPresetToken,
  disableNativePayToken,
}: {
  marketPresetToken?: IMarketPresetTokenContext;
  disableNativePayToken?: boolean;
}) {
  const tokenDetailActions = useTokenDetailActions();
  const { tokenDetail, tokenAddress, networkId, isNative } = useTokenDetail();
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
  const requestedStockTokenKeyRef = useRef('');
  const manualStockPayTokenKeyRef = useRef('');
  const stockTokenSnapshotRef = useRef<ISwapToken | undefined>(undefined);
  const payTokenSnapshotRef = useRef<ISwapToken | undefined>(undefined);

  const isBuySide = tradeSide === ESwapStockTradeSide.Buy;
  const marketPresetTokenKey = getMarketPresetTokenKey(marketPresetToken);
  const activeMarketTokenKey = getTokenIdentityKey({
    networkId: networkId ?? '',
    contractAddress: tokenAddress ?? '',
    isNative: !!isNative,
  });
  const marketStockToken = useMemo(
    () =>
      tokenDetail?.stock
        ? buildStockSwapTokenFromMarketDetail({
            tokenDetail,
            tokenAddress: tokenAddress ?? undefined,
            networkId: networkId ?? undefined,
            isNative: isNative ?? undefined,
          })
        : undefined,
    [isNative, networkId, tokenAddress, tokenDetail],
  );
  const swapPairPayToken = isBuySide ? fromToken : toToken;
  const selectedStockToken = resolveStockChannelToken({
    stockTokenState,
    marketStockToken,
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
  const stockNetworkId = currentStockToken?.networkId ?? networkId ?? '';
  const isActiveMarketStockDetail =
    !!currentStockTokenKey &&
    activeMarketTokenKey === currentStockTokenKey &&
    !!tokenDetail?.stock;

  const requestMarketActiveToken = useCallback(
    (token?: Partial<ISwapTokenBase>) => {
      const tokenKey = getTokenIdentityKey(token);
      if (!token?.networkId || !tokenKey) {
        return;
      }
      requestedStockTokenKeyRef.current = tokenKey;
      if (tokenKey === activeMarketTokenKey) {
        return;
      }
      void tokenDetailActions.current.changeActiveToken({
        tokenAddress: token.contractAddress ?? '',
        networkId: token.networkId,
        isNative: !!token.isNative,
      });
    },
    [activeMarketTokenKey, tokenDetailActions],
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
  }, [currentStockToken, tokenDetail?.stock]);

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
      requestMarketActiveToken(token);
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
  }, [requestMarketActiveToken, selectStockSwapToken]);

  useEffect(() => {
    if (!selectedStockTokenKey || !selectedStockToken?.networkId) {
      return;
    }
    if (requestedStockTokenKeyRef.current === selectedStockTokenKey) {
      return;
    }
    requestMarketActiveToken(selectedStockToken);
  }, [requestMarketActiveToken, selectedStockToken, selectedStockTokenKey]);

  const {
    defaultStockTokenLoading,
    shouldLoadDefaultStockToken,
    stockCategoryType,
  } = useSwapStockDefaultToken({
    marketPresetToken,
    marketPresetTokenKey,
    marketStockToken,
    requestMarketActiveToken,
    selectStockSwapToken,
    selectedStockTokenKey,
    spotCategories,
    tokenDetailHasStock: !!tokenDetail?.stock,
  });

  const stockMarketStatus = useMemo<
    IFetchUSMarketStatusResult | undefined
  >(() => {
    if (!isActiveMarketStockDetail || !tokenDetail?.stock) {
      return undefined;
    }
    const isOpen = tokenDetail.stock.isOpen;
    return {
      open: isOpen === true,
      session: isOpen === true ? 'REGULAR' : 'CLOSED',
      reason: tokenDetail.stock.description ?? null,
      unavailable: typeof isOpen === 'boolean' ? undefined : true,
    };
  }, [isActiveMarketStockDetail, tokenDetail?.stock]);
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
      requestedStockTokenKeyRef.current = getTokenIdentityKey(nextSwapToken);
      defaultLogger.swap.selectToken.selectToken({
        selectFrom: ESwapSelectTokenSource.NORMAL_SELECT,
        tokenRole: SWAP_STOCK_ANALYTICS_TOKEN_ROLE_STOCK,
        tokenListType: SWAP_STOCK_ANALYTICS_TOKEN_LIST_TYPE_STOCK,
      });
      requestMarketActiveToken(nextSwapToken);
      selectStockSwapToken(nextSwapToken, { resetAmounts: true });
    },
    [requestMarketActiveToken, selectStockSwapToken],
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
      if (stockTokenForSwitch?.networkId) {
        requestMarketActiveToken(stockTokenForSwitch);
      }
      await syncStockExecutionTokens({
        nextTradeSide,
        stockToken: stockTokenForSwitch,
        payToken: payTokenForSwitch,
      });
    },
    [
      currentStockToken,
      payToken,
      requestMarketActiveToken,
      resetStockTradeAmounts,
      syncStockExecutionTokens,
      tradeSide,
    ],
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
    if (!isActiveMarketStockDetail || !tokenDetail?.stock) {
      return ESwapStockChannelAsyncStatus.Initializing;
    }
    if (stockMarketStatus) {
      return ESwapStockChannelAsyncStatus.Ready;
    }
    return ESwapStockChannelAsyncStatus.Empty;
  }, [
    currentStockTokenKey,
    isActiveMarketStockDetail,
    stockMarketStatus,
    tokenDetail?.stock,
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
      selectStockToken,
      switchTradeSide,
      speedConfigReady,
      stockMarketStatus,
      stockNetworkId,
      stockTokenStatus,
      toToken,
      tradeSide,
      disableNativePayToken,
    ],
  );
}

export type IUseSwapStockChannelReturn = ReturnType<typeof useSwapStockChannel>;
