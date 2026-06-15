import { useCallback, useEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import {
  useSwapActions,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import { useTokenDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useTokenDetail';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import { isMarketStockCategory } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/utils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketTokenDetail,
  IMarketTokenListItem,
} from '@onekeyhq/shared/types/marketV2';
import { mevSwapNetworks } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IFetchUSMarketStatusResult,
  IMarketPresetTokenContext,
  ISpeedSwapConfig,
  ISwapToken,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';

export enum ESwapStockChannelAsyncStatus {
  Idle = 'idle',
  Initializing = 'initializing',
  Ready = 'ready',
  Empty = 'empty',
}

export enum ESwapStockChannelStage {
  InitializingStock = 'initializingStock',
  MissingStock = 'missingStock',
  CheckingMarketStatus = 'checkingMarketStatus',
  MarketClosed = 'marketClosed',
  InitializingPayToken = 'initializingPayToken',
  MissingPayToken = 'missingPayToken',
  Ready = 'ready',
}

export enum ESwapStockTradeSide {
  Buy = 'buy',
  Sell = 'sell',
}

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

const EMPTY_DEFAULT_TOKENS: IToken[] = [];

function getTokenIdentityKey(token?: Partial<ISwapTokenBase>) {
  if (!token?.networkId) {
    return '';
  }
  return `${token.networkId}:${token.contractAddress ?? ''}:${
    token.isNative ? 'native' : 'token'
  }`;
}

function getMarketPresetTokenKey(token?: IMarketPresetTokenContext) {
  if (!token?.networkId) {
    return '';
  }
  return `${token.networkId}:${token.contractAddress ?? ''}:${
    token.isNative ? 'native' : 'token'
  }`;
}

function getMarketListTokenKey(token?: IMarketTokenListItem) {
  const networkId = token?.networkId ?? token?.chainId ?? '';
  if (!networkId || !token) {
    return '';
  }
  return `${networkId}:${token.address}:${token.isNative ? 'native' : 'token'}`;
}

function buildStockSwapTokenFromMarketToken(token: IMarketToken): ISwapToken {
  return {
    networkId: token.networkId,
    contractAddress: token.address,
    decimals: token.decimals,
    symbol: token.symbol,
    name: token.name,
    logoURI: token.tokenImageUri,
    networkLogoURI: token.networkLogoUri,
    isNative: !!token.isNative,
    price: token.price ? token.price.toString() : undefined,
  };
}

function buildStockSwapTokenFromMarketListToken(
  token: IMarketTokenListItem,
): ISwapToken | undefined {
  const networkId = token.networkId ?? token.chainId;
  if (!networkId) {
    return undefined;
  }
  return {
    networkId,
    contractAddress: token.address,
    decimals: token.decimals,
    symbol: token.symbol,
    name: token.name,
    logoURI: token.logoUrl,
    isNative: !!token.isNative,
    price: token.price,
  };
}

function buildStockSwapTokenFromMarketDetail({
  tokenDetail,
  tokenAddress,
  networkId,
  isNative,
}: {
  tokenDetail?: IMarketTokenDetail;
  tokenAddress?: string;
  networkId?: string;
  isNative?: boolean;
}): ISwapToken | undefined {
  const resolvedNetworkId = tokenDetail?.networkId ?? networkId;
  const resolvedTokenAddress = tokenAddress ?? tokenDetail?.address;
  if (!tokenDetail || !resolvedNetworkId || !resolvedTokenAddress) {
    return undefined;
  }
  return {
    networkId: resolvedNetworkId,
    contractAddress: resolvedTokenAddress,
    decimals: tokenDetail.decimals,
    symbol: tokenDetail.symbol,
    name: tokenDetail.name,
    logoURI: tokenDetail.logoUrl,
    isNative: !!(isNative ?? tokenDetail.isNative),
    price: tokenDetail.priceConverted ?? tokenDetail.price,
  };
}

function findTokenFromCandidates({
  candidates,
  token,
}: {
  candidates: IToken[];
  token?: Partial<ISwapTokenBase>;
}) {
  if (!token) {
    return undefined;
  }
  return candidates.find((candidate) =>
    equalTokenNoCaseSensitive({
      token1: candidate,
      token2: token,
    }),
  );
}

function findDefaultStockPayToken(candidates: IToken[]) {
  return (
    candidates.find(
      (candidate) => candidate.symbol?.toUpperCase() === 'USDC',
    ) ?? candidates[0]
  );
}

export function useSwapStockChannel({
  marketPresetToken,
  disableNativePayToken,
  tradeSide,
}: {
  marketPresetToken?: IMarketPresetTokenContext;
  disableNativePayToken?: boolean;
  tradeSide: ESwapStockTradeSide;
}) {
  const tokenDetailActions = useTokenDetailActions();
  const { tokenDetail, tokenAddress, networkId, isNative } = useTokenDetail();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const { selectFromToken, selectToToken } = useSwapActions().current;
  const { spotCategories } = useMarketBasicConfig();
  const requestedStockTokenKeyRef = useRef('');
  const manualStockPayTokenKeyRef = useRef('');
  const tradeSideSwitchingRef = useRef(false);
  const tradeSideSwitchingTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const stockTokenSnapshotRef = useRef<ISwapToken | undefined>(undefined);
  const payTokenSnapshotRef = useRef<ISwapToken | undefined>(undefined);

  const isBuySide = tradeSide === ESwapStockTradeSide.Buy;
  const marketPresetTokenKey = getMarketPresetTokenKey(marketPresetToken);
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
  const payToken = isBuySide ? fromToken : toToken;
  const selectedStockToken = isBuySide ? toToken : fromToken;
  const selectedStockTokenKey = getTokenIdentityKey(selectedStockToken);
  const currentStockToken = selectedStockToken ?? marketStockToken;
  const currentStockTokenKey = getTokenIdentityKey(currentStockToken);
  const stockNetworkId = currentStockToken?.networkId ?? networkId ?? '';

  useEffect(() => {
    if (currentStockToken && tokenDetail?.stock) {
      stockTokenSnapshotRef.current = currentStockToken;
    }
  }, [currentStockToken, tokenDetail?.stock]);

  useEffect(() => {
    if (payToken) {
      payTokenSnapshotRef.current = payToken;
    }
  }, [payToken]);

  const stockCategoryType = useMemo(() => {
    const stockCategory = spotCategories.find((category) =>
      isMarketStockCategory({
        id: category.type,
        name: category.name,
      }),
    );
    return stockCategory?.type;
  }, [spotCategories]);

  const selectStockSwapToken = useCallback(
    async (token: ISwapToken) => {
      if (isBuySide) {
        await selectToToken(token, true, true);
        return;
      }
      await selectFromToken(token, true, true, true);
    },
    [isBuySide, selectFromToken, selectToToken],
  );

  useEffect(() => {
    if (tradeSideSwitchingRef.current) {
      return;
    }
    if (!selectedStockTokenKey || !selectedStockToken?.networkId) {
      return;
    }
    if (requestedStockTokenKeyRef.current === selectedStockTokenKey) {
      return;
    }
    requestedStockTokenKeyRef.current = selectedStockTokenKey;
    void tokenDetailActions.current.changeActiveToken({
      tokenAddress: selectedStockToken.contractAddress ?? '',
      networkId: selectedStockToken.networkId,
      isNative: !!selectedStockToken.isNative,
    });
  }, [selectedStockToken, selectedStockTokenKey, tokenDetailActions]);

  useEffect(() => {
    if (tradeSideSwitchingRef.current) {
      return;
    }
    if (
      selectedStockTokenKey ||
      !marketPresetTokenKey ||
      !marketPresetToken?.networkId
    ) {
      return;
    }
    if (requestedStockTokenKeyRef.current === marketPresetTokenKey) {
      return;
    }
    requestedStockTokenKeyRef.current = marketPresetTokenKey;
    void tokenDetailActions.current.changeActiveToken({
      tokenAddress: marketPresetToken.contractAddress ?? '',
      networkId: marketPresetToken.networkId,
      isNative: !!marketPresetToken.isNative,
    });
  }, [
    marketPresetToken,
    marketPresetTokenKey,
    selectedStockTokenKey,
    tokenDetailActions,
  ]);

  const shouldLoadDefaultStockToken =
    !selectedStockTokenKey && !marketPresetTokenKey && !marketStockToken;
  const defaultStockTokenScope = `${shouldLoadDefaultStockToken ? '1' : '0'}:${
    stockCategoryType ?? ''
  }`;
  const {
    result: defaultStockTokenState,
    isLoading: defaultStockTokenLoading,
  } = usePromiseResult(
    async () => {
      if (!shouldLoadDefaultStockToken || !stockCategoryType) {
        return {
          scope: defaultStockTokenScope,
          token: undefined as IMarketTokenListItem | undefined,
        };
      }
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenList({
          networkId: '',
          type: stockCategoryType,
          sortBy: 'v24hUSD',
          sortType: 'desc',
          page: 1,
          limit: 1,
        });
      return {
        scope: defaultStockTokenScope,
        token: response.list.find((item) => !!item.stock) ?? response.list[0],
      };
    },
    [defaultStockTokenScope, shouldLoadDefaultStockToken, stockCategoryType],
    {
      initResult: {
        scope: '',
        token: undefined as IMarketTokenListItem | undefined,
      },
      watchLoading: shouldLoadDefaultStockToken,
    },
  );

  const defaultStockToken =
    defaultStockTokenState.scope === defaultStockTokenScope
      ? defaultStockTokenState.token
      : undefined;
  const defaultStockTokenKey = getMarketListTokenKey(defaultStockToken);

  useEffect(() => {
    if (tradeSideSwitchingRef.current) {
      return;
    }
    const defaultStockNetworkId =
      defaultStockToken?.networkId ?? defaultStockToken?.chainId;
    if (
      !shouldLoadDefaultStockToken ||
      !defaultStockToken ||
      !defaultStockTokenKey ||
      !defaultStockNetworkId
    ) {
      return;
    }
    if (requestedStockTokenKeyRef.current === defaultStockTokenKey) {
      return;
    }
    requestedStockTokenKeyRef.current = defaultStockTokenKey;
    void tokenDetailActions.current.changeActiveToken({
      tokenAddress: defaultStockToken.address,
      networkId: defaultStockNetworkId,
      isNative: !!defaultStockToken.isNative,
    });
    const nextSwapToken =
      buildStockSwapTokenFromMarketListToken(defaultStockToken);
    if (nextSwapToken) {
      void selectStockSwapToken(nextSwapToken);
    }
  }, [
    defaultStockToken,
    defaultStockTokenKey,
    selectStockSwapToken,
    shouldLoadDefaultStockToken,
    tokenDetailActions,
  ]);

  useEffect(() => {
    if (tradeSideSwitchingRef.current) {
      return;
    }
    if (selectedStockTokenKey || !marketStockToken || !tokenDetail?.stock) {
      return;
    }
    void selectStockSwapToken(marketStockToken);
  }, [
    marketStockToken,
    selectStockSwapToken,
    selectedStockTokenKey,
    tokenDetail?.stock,
  ]);

  const stockMarketStatusScope = currentStockTokenKey;
  const {
    result: stockMarketStatusState,
    isLoading: stockMarketStatusLoading,
  } = usePromiseResult(
    async () => {
      if (!currentStockTokenKey) {
        return {
          scope: stockMarketStatusScope,
          status: undefined as IFetchUSMarketStatusResult | undefined,
        };
      }
      const status =
        await backgroundApiProxy.serviceSwap.fetchCheckUSMarketStatus();
      return {
        scope: stockMarketStatusScope,
        status,
      };
    },
    [currentStockTokenKey, stockMarketStatusScope],
    {
      initResult: {
        scope: '',
        status: undefined as IFetchUSMarketStatusResult | undefined,
      },
      watchLoading: !!currentStockTokenKey,
    },
  );
  const stockMarketStatus =
    stockMarketStatusState.scope === stockMarketStatusScope
      ? stockMarketStatusState.status
      : undefined;
  const stockMarketStatusOpen =
    !stockMarketStatus ||
    stockMarketStatus.unavailable ||
    stockMarketStatus.open;

  const speedSwapConfigScope = stockNetworkId;
  const { result: speedSwapConfigState, isLoading: payTokenOptionsLoading } =
    usePromiseResult(
      async () => {
        if (!stockNetworkId) {
          return {
            scope: speedSwapConfigScope,
            config: defaultSpeedSwapConfig,
          };
        }
        const config =
          await backgroundApiProxy.serviceSwap.fetchSpeedSwapConfig({
            networkId: stockNetworkId,
          });
        return {
          scope: speedSwapConfigScope,
          config,
        };
      },
      [speedSwapConfigScope, stockNetworkId],
      {
        initResult: {
          scope: '',
          config: defaultSpeedSwapConfig,
        },
        watchLoading: true,
      },
    );
  const speedConfigReady = speedSwapConfigState.scope === speedSwapConfigScope;
  const defaultTokens = useMemo(
    () =>
      (speedConfigReady
        ? speedSwapConfigState.config.speedConfig.defaultTokens
        : EMPTY_DEFAULT_TOKENS) as IToken[],
    [speedConfigReady, speedSwapConfigState.config.speedConfig.defaultTokens],
  );

  useEffect(() => {
    manualStockPayTokenKeyRef.current = '';
  }, [stockNetworkId]);

  const payTokens = useMemo(() => {
    if (!defaultTokens?.length) {
      return [];
    }
    if (!currentStockTokenKey || defaultTokens.length === 1) {
      return [...defaultTokens];
    }
    return defaultTokens.filter(
      (token) =>
        !equalTokenNoCaseSensitive({
          token1: token,
          token2: currentStockToken,
        }),
    );
  }, [currentStockToken, currentStockTokenKey, defaultTokens]);

  const selectablePayTokens = useMemo(
    () =>
      disableNativePayToken
        ? payTokens.filter((token) => !token.isNative)
        : payTokens,
    [disableNativePayToken, payTokens],
  );

  const selectPayToken = useCallback(
    (token: IToken, manual = true) => {
      if (manual) {
        manualStockPayTokenKeyRef.current = getTokenIdentityKey(token);
      }
      if (isBuySide) {
        void selectFromToken(token as ISwapToken, true, true, true);
        return;
      }
      void selectToToken(token as ISwapToken, true, true);
    },
    [isBuySide, selectFromToken, selectToToken],
  );

  useEffect(() => {
    if (tradeSideSwitchingRef.current) {
      return;
    }
    if (!speedConfigReady || selectablePayTokens.length === 0) {
      return;
    }

    const currentToken = findTokenFromCandidates({
      candidates: selectablePayTokens,
      token: payToken,
    });
    const preferredToken = findDefaultStockPayToken(selectablePayTokens);
    if (
      currentToken &&
      (manualStockPayTokenKeyRef.current ===
        getTokenIdentityKey(currentToken) ||
        equalTokenNoCaseSensitive({
          token1: currentToken,
          token2: preferredToken,
        }))
    ) {
      return;
    }

    selectPayToken(preferredToken, false);
  }, [payToken, selectablePayTokens, selectPayToken, speedConfigReady]);

  const selectStockToken = useCallback(
    (token: IMarketToken) => {
      const nextSwapToken = buildStockSwapTokenFromMarketToken(token);
      requestedStockTokenKeyRef.current = getTokenIdentityKey(nextSwapToken);
      void tokenDetailActions.current.changeActiveToken({
        tokenAddress: token.address,
        networkId: token.networkId,
        isNative: !!token.isNative,
      });
      void selectStockSwapToken(nextSwapToken);
    },
    [selectStockSwapToken, tokenDetailActions],
  );

  const switchTradeSide = useCallback(
    async (nextTradeSide: ESwapStockTradeSide) => {
      if (nextTradeSide === tradeSide) {
        return;
      }
      tradeSideSwitchingRef.current = true;
      if (tradeSideSwitchingTimerRef.current) {
        clearTimeout(tradeSideSwitchingTimerRef.current);
      }
      const stockTokenForSwitch =
        stockTokenSnapshotRef.current ?? currentStockToken;
      const payTokenForSwitch = payTokenSnapshotRef.current ?? payToken;
      const nextFromToken =
        nextTradeSide === ESwapStockTradeSide.Buy
          ? payTokenForSwitch
          : stockTokenForSwitch;
      const nextToToken =
        nextTradeSide === ESwapStockTradeSide.Buy
          ? stockTokenForSwitch
          : payTokenForSwitch;
      const nextStockToken =
        nextTradeSide === ESwapStockTradeSide.Buy ? nextToToken : nextFromToken;
      if (nextStockToken?.networkId) {
        requestedStockTokenKeyRef.current = getTokenIdentityKey(nextStockToken);
        void tokenDetailActions.current.changeActiveToken({
          tokenAddress: nextStockToken.contractAddress ?? '',
          networkId: nextStockToken.networkId,
          isNative: !!nextStockToken.isNative,
        });
      }
      if (nextFromToken) {
        await selectFromToken(nextFromToken, true, true, true);
      }
      if (nextToToken) {
        await selectToToken(nextToToken, true, true);
      }
      tradeSideSwitchingTimerRef.current = setTimeout(() => {
        tradeSideSwitchingRef.current = false;
      }, 500);
    },
    [
      currentStockToken,
      payToken,
      selectFromToken,
      selectToToken,
      tokenDetailActions,
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
    if (stockMarketStatusLoading) {
      return ESwapStockChannelAsyncStatus.Initializing;
    }
    if (stockMarketStatus) {
      return ESwapStockChannelAsyncStatus.Ready;
    }
    return ESwapStockChannelAsyncStatus.Empty;
  }, [currentStockTokenKey, stockMarketStatus, stockMarketStatusLoading]);

  const payTokenStatus = useMemo(() => {
    if (!stockNetworkId) {
      return ESwapStockChannelAsyncStatus.Idle;
    }
    if (payTokenOptionsLoading || !speedConfigReady) {
      return ESwapStockChannelAsyncStatus.Initializing;
    }
    if (selectablePayTokens.length === 0) {
      return ESwapStockChannelAsyncStatus.Empty;
    }
    return ESwapStockChannelAsyncStatus.Ready;
  }, [
    payTokenOptionsLoading,
    selectablePayTokens.length,
    speedConfigReady,
    stockNetworkId,
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
