import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
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
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
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
  MarketUnavailable = 'marketUnavailable',
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
const STOCK_DEFAULT_PAY_SYMBOLS = new Set(['USDC', 'USDT']);

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

function getStockDefaultPayTokenCandidates(candidates: IToken[]) {
  const stablePayTokens = candidates.filter((candidate) =>
    STOCK_DEFAULT_PAY_SYMBOLS.has(candidate.symbol?.toUpperCase() ?? ''),
  );
  return stablePayTokens.length ? stablePayTokens : candidates;
}

function getTokenBalanceValue({
  token,
  balances,
}: {
  token: IToken;
  balances?: Record<string, string | undefined>;
}) {
  const balance =
    balances?.[getTokenIdentityKey(token)] ?? token.balanceParsed ?? '0';
  const value = new BigNumber(balance);
  return value.isFinite() ? value : new BigNumber(0);
}

function findDefaultStockPayToken({
  candidates,
  balances,
}: {
  candidates: IToken[];
  balances?: Record<string, string | undefined>;
}) {
  const preferredCandidates = getStockDefaultPayTokenCandidates(candidates);
  if (balances) {
    let bestToken = preferredCandidates[0];
    let bestBalance = bestToken
      ? getTokenBalanceValue({ token: bestToken, balances })
      : new BigNumber(0);
    for (const token of preferredCandidates.slice(1)) {
      const balance = getTokenBalanceValue({ token, balances });
      if (balance.gt(bestBalance)) {
        bestToken = token;
        bestBalance = balance;
      }
    }
    if (bestToken && bestBalance.gt(0)) {
      return bestToken;
    }
  }
  return preferredCandidates[0] ?? candidates[0];
}

export function useSwapStockChannel({
  marketPresetToken,
  disableNativePayToken,
}: {
  marketPresetToken?: IMarketPresetTokenContext;
  disableNativePayToken?: boolean;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const tokenDetailActions = useTokenDetailActions();
  const { tokenDetail, tokenAddress, networkId, isNative } = useTokenDetail();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const { selectFromToken, selectToToken } = useSwapActions().current;
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
  const swapPairStockToken = isBuySide ? toToken : fromToken;
  const selectedStockToken = stockTokenState ?? swapPairStockToken;
  const selectedStockTokenKey = getTokenIdentityKey(selectedStockToken);
  const currentStockToken = selectedStockToken ?? marketStockToken;
  const currentStockTokenKey = getTokenIdentityKey(currentStockToken);
  const payToken = payTokenState ?? swapPairPayToken;
  const stockNetworkId = currentStockToken?.networkId ?? networkId ?? '';
  const activeMarketTokenKey = getTokenIdentityKey({
    networkId: networkId ?? '',
    contractAddress: tokenAddress ?? '',
    isNative: !!isNative,
  });

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

      if (nextFromToken) {
        await selectFromToken(nextFromToken, true, true, true);
      }
      if (nextToToken) {
        await selectToToken(nextToToken, true, true);
      }
    },
    [currentStockToken, payToken, selectFromToken, selectToToken, tradeSide],
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
      setStockTokenState(token);
      stockTokenSnapshotRef.current = token;
      await syncStockExecutionTokens({
        stockToken: token,
      });
    },
    [syncStockExecutionTokens],
  );

  useEffect(() => {
    const handleSwapStockTokenSelected = (token: ISwapToken) => {
      if (!token?.networkId) {
        return;
      }
      requestMarketActiveToken(token);
      void selectStockSwapToken(token);
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

  useEffect(() => {
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
    requestMarketActiveToken(marketPresetToken);
  }, [
    marketPresetToken,
    marketPresetTokenKey,
    requestMarketActiveToken,
    selectedStockTokenKey,
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
    requestMarketActiveToken({
      contractAddress: defaultStockToken.address,
      networkId: defaultStockNetworkId,
      isNative: defaultStockToken.isNative,
    });
    const nextSwapToken =
      buildStockSwapTokenFromMarketListToken(defaultStockToken);
    if (nextSwapToken) {
      void selectStockSwapToken(nextSwapToken);
    }
  }, [
    defaultStockToken,
    defaultStockTokenKey,
    requestMarketActiveToken,
    selectStockSwapToken,
    shouldLoadDefaultStockToken,
  ]);

  useEffect(() => {
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

  const stockMarketStatus = useMemo<
    IFetchUSMarketStatusResult | undefined
  >(() => {
    if (!currentStockTokenKey || !tokenDetail?.stock) {
      return undefined;
    }
    const isOpen = tokenDetail.stock.isOpen;
    return {
      open: isOpen === true,
      session: isOpen === true ? 'REGULAR' : 'CLOSED',
      reason: tokenDetail.stock.description ?? null,
      unavailable: typeof isOpen === 'boolean' ? undefined : true,
    };
  }, [currentStockTokenKey, tokenDetail?.stock]);
  const stockMarketStatusOpen = stockMarketStatus?.open === true;

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
  const selectablePayTokenKeys = useMemo(
    () => selectablePayTokens.map(getTokenIdentityKey).join('|'),
    [selectablePayTokens],
  );
  const hasActiveAccount = Boolean(
    activeAccount?.indexedAccount?.id || activeAccount?.account?.id,
  );
  const shouldLoadPayTokenBalances = Boolean(
    speedConfigReady && selectablePayTokens.length > 0,
  );
  const payTokenBalanceScope = `${
    shouldLoadPayTokenBalances ? '1' : '0'
  }:${selectablePayTokenKeys}:${activeAccount?.indexedAccount?.id ?? ''}:${
    activeAccount?.account?.id ?? ''
  }`;
  const { result: payTokenBalanceState, isLoading: payTokenBalanceLoading } =
    usePromiseResult(
      async () => {
        if (!shouldLoadPayTokenBalances) {
          return {
            scope: payTokenBalanceScope,
            balances: {} as Record<string, string | undefined>,
          };
        }
        if (!hasActiveAccount) {
          return {
            scope: payTokenBalanceScope,
            balances: selectablePayTokens.reduce<
              Record<string, string | undefined>
            >((acc, token) => {
              acc[getTokenIdentityKey(token)] = token.balanceParsed ?? '0';
              return acc;
            }, {}),
          };
        }

        const accountRequestMap = new Map<
          string,
          Promise<
            | {
                id?: string;
                address?: string;
              }
            | undefined
          >
        >();
        const getNetworkAccount = (tokenNetworkId: string) => {
          const cachedRequest = accountRequestMap.get(tokenNetworkId);
          if (cachedRequest) {
            return cachedRequest;
          }
          const request = (async () => {
            const defaultDeriveType =
              await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                {
                  networkId: tokenNetworkId,
                },
              );
            return backgroundApiProxy.serviceAccount.getNetworkAccount({
              accountId: activeAccount?.indexedAccount?.id
                ? undefined
                : activeAccount?.account?.id,
              indexedAccountId: activeAccount?.indexedAccount?.id ?? '',
              networkId: tokenNetworkId,
              deriveType: defaultDeriveType ?? 'default',
            });
          })();
          accountRequestMap.set(tokenNetworkId, request);
          return request;
        };

        const balanceEntries = await Promise.all(
          selectablePayTokens.map(async (token) => {
            const fallbackBalance = token.balanceParsed ?? '0';
            try {
              const networkAccount = await getNetworkAccount(token.networkId);
              if (!networkAccount?.id || !networkAccount?.address) {
                return [getTokenIdentityKey(token), fallbackBalance] as const;
              }
              const details =
                await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
                  networkId: token.networkId,
                  contractAddress: token.contractAddress,
                  accountId: networkAccount.id,
                  accountAddress: networkAccount.address,
                  currency: 'usd',
                });
              return [
                getTokenIdentityKey(token),
                details?.[0]?.balanceParsed ?? fallbackBalance,
              ] as const;
            } catch {
              return [getTokenIdentityKey(token), fallbackBalance] as const;
            }
          }),
        );
        return {
          scope: payTokenBalanceScope,
          balances: Object.fromEntries(balanceEntries),
        };
      },
      [
        activeAccount?.account?.id,
        activeAccount?.indexedAccount?.id,
        hasActiveAccount,
        payTokenBalanceScope,
        selectablePayTokens,
        shouldLoadPayTokenBalances,
      ],
      {
        initResult: {
          scope: '',
          balances: {} as Record<string, string | undefined>,
        },
        watchLoading: shouldLoadPayTokenBalances,
      },
    );
  const payTokenBalanceReady =
    payTokenBalanceState.scope === payTokenBalanceScope;
  const payTokenBalances = payTokenBalanceReady
    ? payTokenBalanceState.balances
    : undefined;

  const selectPayToken = useCallback(
    (token: IToken, manual = true) => {
      if (manual) {
        manualStockPayTokenKeyRef.current = getTokenIdentityKey(token);
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

  useEffect(() => {
    if (
      !speedConfigReady ||
      selectablePayTokens.length === 0 ||
      !payTokenBalanceReady
    ) {
      return;
    }

    const currentToken = findTokenFromCandidates({
      candidates: selectablePayTokens,
      token: payToken,
    });
    const preferredToken = findDefaultStockPayToken({
      candidates: selectablePayTokens,
      balances: payTokenBalances,
    });
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
  }, [
    payToken,
    payTokenBalanceReady,
    payTokenBalances,
    selectablePayTokens,
    selectPayToken,
    speedConfigReady,
  ]);

  const selectStockToken = useCallback(
    (token: IMarketToken) => {
      const nextSwapToken = buildStockSwapTokenFromMarketToken(token);
      requestedStockTokenKeyRef.current = getTokenIdentityKey(nextSwapToken);
      requestMarketActiveToken(nextSwapToken);
      void selectStockSwapToken(nextSwapToken);
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
    if (!tokenDetail?.stock) {
      return ESwapStockChannelAsyncStatus.Initializing;
    }
    if (stockMarketStatus) {
      return ESwapStockChannelAsyncStatus.Ready;
    }
    return ESwapStockChannelAsyncStatus.Empty;
  }, [currentStockTokenKey, stockMarketStatus, tokenDetail?.stock]);

  const payTokenStatus = useMemo(() => {
    if (!stockNetworkId) {
      return ESwapStockChannelAsyncStatus.Idle;
    }
    if (
      payTokenOptionsLoading ||
      !speedConfigReady ||
      (shouldLoadPayTokenBalances &&
        (!payTokenBalanceReady || payTokenBalanceLoading))
    ) {
      return ESwapStockChannelAsyncStatus.Initializing;
    }
    if (selectablePayTokens.length === 0) {
      return ESwapStockChannelAsyncStatus.Empty;
    }
    return ESwapStockChannelAsyncStatus.Ready;
  }, [
    payTokenOptionsLoading,
    payTokenBalanceLoading,
    payTokenBalanceReady,
    selectablePayTokens.length,
    shouldLoadPayTokenBalances,
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
