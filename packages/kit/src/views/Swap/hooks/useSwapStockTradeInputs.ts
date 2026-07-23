import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSwapAlertsAtom,
  useSwapFromTokenAmountAtom,
  useSwapStockBalanceDisplayCacheAtom,
  useSwapStockSelectedFromTokenBalanceAtom,
  useSwapToTokenAmountAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { buildSwapSelectedTokensColdStartAccountKey } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  EProtocolOfExchange,
  type IFetchQuoteResult,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  resolveSwapBalanceDisplayCacheEntry,
  updateSwapBalanceDisplayCache,
} from '../utils/swapBalanceDisplayCacheUtils';
import { buildSwapRateDifference } from '../utils/swapRateDifferenceUtils';

import {
  type IStockBalanceSnapshot,
  isStockBalanceInitializing,
  isStockPayTokenReadyForTradeInput,
  resolveStockBalanceSeed,
  resolveStockBalanceSnapshot,
  resolveStockBalanceViewState,
  shouldRenderStockTradeInputSkeleton,
} from './swapStockChannelUtils';
import {
  STOCK_PRICE_SOURCE_CURRENCY,
  getStockTokenFiatValue,
  markStockUsdPriceCurrency,
  resolveStockTokenPrice,
} from './swapStockFiatValueUtils';
import { isQuoteResultForStockTrade } from './swapStockQuoteUtils';
import {
  ESwapStockChannelAsyncStatus,
  ESwapStockTradeSide,
  type IUseSwapStockChannelReturn,
} from './useSwapStockChannel';

function getNetworkLogoURI(networkId?: string) {
  if (!networkId) {
    return undefined;
  }
  return Object.values(presetNetworksMap).find(
    (network) => network.id === networkId,
  )?.logoURI;
}

function getStockInputTokenIdentityKey(token?: Partial<ISwapToken>) {
  if (!token?.networkId) {
    return '';
  }
  return `${token.networkId}:${token.contractAddress ?? ''}:${
    token.isNative ? 'native' : 'token'
  }`;
}

function useStockInputTokenBalance({
  enabled,
  token,
}: {
  enabled: boolean;
  token?: ISwapToken;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [balanceDisplayCache, setBalanceDisplayCache] =
    useSwapStockBalanceDisplayCacheAtom();
  const [refreshKey, setRefreshKey] = useState(0);
  const lastValidBalanceStateRef = useRef<IStockBalanceSnapshot | undefined>(
    undefined,
  );
  const tokenScope = getStockInputTokenIdentityKey(token);
  const balanceAccountKey =
    buildSwapSelectedTokensColdStartAccountKey(activeAccount);
  const hasActiveAccount = Boolean(
    activeAccount?.indexedAccount?.id || activeAccount?.account?.id,
  );
  const tokenNetworkId = token?.networkId ?? '';
  const accountNetworkReady = Boolean(
    !hasActiveAccount || activeAccount?.ready,
  );
  const balanceOwnerScope = `${tokenScope}:${balanceAccountKey ?? ''}`;
  const shouldFetchNetworkAccount = Boolean(
    enabled && tokenNetworkId && hasActiveAccount && accountNetworkReady,
  );
  const networkAccountScope = `${
    shouldFetchNetworkAccount ? '1' : '0'
  }:${tokenNetworkId}:${activeAccount?.indexedAccount?.id ?? ''}:${
    activeAccount?.account?.id ?? ''
  }`;
  const { result: networkAccountState, isLoading: networkAccountLoading } =
    usePromiseResult(
      async () => {
        if (!shouldFetchNetworkAccount || !tokenNetworkId) {
          return {
            scope: networkAccountScope,
            account: null,
          };
        }
        try {
          const defaultDeriveType =
            await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
              {
                networkId: tokenNetworkId,
              },
            );
          const account =
            await backgroundApiProxy.serviceAccount.getNetworkAccount({
              accountId: activeAccount?.indexedAccount?.id
                ? undefined
                : activeAccount?.account?.id,
              indexedAccountId: activeAccount?.indexedAccount?.id ?? '',
              networkId: tokenNetworkId,
              deriveType: defaultDeriveType ?? 'default',
            });
          return {
            scope: networkAccountScope,
            account,
          };
        } catch {
          return {
            scope: networkAccountScope,
            account: null,
          };
        }
      },
      [
        activeAccount?.account?.id,
        activeAccount?.indexedAccount?.id,
        networkAccountScope,
        shouldFetchNetworkAccount,
        tokenNetworkId,
      ],
      {
        initResult: {
          scope: '',
          account: null,
        },
        watchLoading: shouldFetchNetworkAccount,
      },
    );
  const networkAccountReady =
    !shouldFetchNetworkAccount ||
    networkAccountState.scope === networkAccountScope;
  const networkAccount =
    shouldFetchNetworkAccount && networkAccountReady
      ? networkAccountState.account
      : null;
  const seededBalance = resolveStockBalanceSeed({
    hasActiveAccount,
    networkAccountAddress: networkAccount?.address,
    token,
  });
  const balanceScope = `${tokenScope}:${
    networkAccountReady ? 'ready' : 'pending'
  }:${networkAccount?.id ?? ''}:${networkAccount?.address ?? ''}:${refreshKey}`;
  const shouldWaitForNetworkAccount =
    Boolean(
      enabled && tokenNetworkId && hasActiveAccount && !accountNetworkReady,
    ) ||
    (shouldFetchNetworkAccount && !networkAccountReady);
  const { result: detailState, isLoading: detailLoading } = usePromiseResult(
    async () => {
      if (!enabled || !token || shouldWaitForNetworkAccount) {
        return {
          scope: balanceScope,
          balance: undefined as string | undefined,
          hasAuthoritativeBalance: false,
          tokenDetail: undefined as ISwapToken | undefined,
        };
      }
      if (!networkAccount) {
        return {
          scope: balanceScope,
          balance: hasActiveAccount ? undefined : (seededBalance ?? '0'),
          hasAuthoritativeBalance: false,
          tokenDetail: token,
        };
      }
      const details =
        await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
          protocol: EProtocolOfExchange.STOCK,
          networkId: token.networkId,
          contractAddress: token.contractAddress,
          accountId: networkAccount.id,
          accountAddress: networkAccount.address,
          currency: 'usd',
        });
      return {
        scope: balanceScope,
        balance: details?.[0]?.balanceParsed ?? seededBalance ?? '0',
        hasAuthoritativeBalance: details?.[0]?.balanceParsed !== undefined,
        tokenDetail: markStockUsdPriceCurrency(details?.[0]),
      };
    },
    [
      balanceScope,
      enabled,
      hasActiveAccount,
      networkAccount,
      seededBalance,
      shouldWaitForNetworkAccount,
      token,
    ],
    {
      initResult: {
        scope: '',
        balance: undefined as string | undefined,
        hasAuthoritativeBalance: false,
        tokenDetail: undefined as ISwapToken | undefined,
      },
      watchLoading: enabled,
    },
  );

  useEffect(() => {
    if (!enabled || !token?.networkId) {
      return;
    }
    const handleSwapHistoryStatusUpdate = ({
      fromToken,
      toToken,
    }: {
      fromToken?: ISwapToken;
      toToken?: ISwapToken;
    }) => {
      if (
        equalTokenNoCaseSensitive({ token1: fromToken, token2: token }) ||
        equalTokenNoCaseSensitive({ token1: toToken, token2: token })
      ) {
        setRefreshKey((value) => value + 1);
      }
    };
    appEventBus.on(
      EAppEventBusNames.SwapTxHistoryStatusUpdate,
      handleSwapHistoryStatusUpdate,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.SwapTxHistoryStatusUpdate,
        handleSwapHistoryStatusUpdate,
      );
    };
  }, [enabled, token]);

  const detailResolved = detailState.scope === balanceScope;
  const balanceReady = detailResolved && detailState.balance !== undefined;
  const balanceState = resolveStockBalanceSnapshot({
    authoritativeBalance: balanceReady ? detailState.balance : undefined,
    authoritativeTokenDetail: balanceReady
      ? detailState.tokenDetail
      : undefined,
    ownerScope: balanceOwnerScope,
    previousSnapshot: lastValidBalanceStateRef.current,
    seededBalance: enabled ? seededBalance : undefined,
    seededTokenDetail: enabled ? token : undefined,
  });
  if (balanceState) {
    lastValidBalanceStateRef.current = balanceState;
  }
  const cachedDisplayBalance = resolveSwapBalanceDisplayCacheEntry({
    accountAddress: networkAccount?.address,
    accountKey: balanceAccountKey,
    cache: balanceDisplayCache,
    token,
  })?.balance;
  const balanceViewState = resolveStockBalanceViewState({
    balanceSnapshot: balanceState,
    cachedDisplayBalance,
  });

  useEffect(() => {
    if (
      !detailResolved ||
      !detailState.hasAuthoritativeBalance ||
      detailState.balance === undefined ||
      !networkAccount?.address ||
      !token
    ) {
      return;
    }
    setBalanceDisplayCache((cache) =>
      updateSwapBalanceDisplayCache({
        accountAddress: networkAccount.address,
        accountKey: balanceAccountKey,
        balance: detailState.balance,
        cache,
        token,
      }),
    );
  }, [
    balanceAccountKey,
    detailResolved,
    detailState.balance,
    detailState.hasAuthoritativeBalance,
    networkAccount?.address,
    setBalanceDisplayCache,
    token,
  ]);

  return {
    balance: balanceViewState.balance,
    displayBalance: balanceViewState.displayBalance,
    tokenDetail: balanceViewState.tokenDetail,
    loading: isStockBalanceInitializing({
      balance: balanceViewState.displayBalance,
      requestPending:
        enabled &&
        Boolean(
          token &&
          (!detailResolved ||
            networkAccountLoading ||
            shouldWaitForNetworkAccount ||
            detailLoading),
        ),
    }),
  };
}

export function useSwapStockEstimatedReceiveState({
  forceHideQuote,
  quoteResult,
  quoteLoading,
  quoteEventFetching,
  stockChannel,
}: {
  forceHideQuote?: boolean;
  quoteResult?: IFetchQuoteResult;
  quoteLoading: boolean;
  quoteEventFetching: boolean;
  stockChannel: IUseSwapStockChannelReturn;
}) {
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [toTokenAmount, setToTokenAmount] = useSwapToTokenAmountAtom();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const [isReceiveTokenPopoverOpen, setIsReceiveTokenPopoverOpen] =
    useState(false);
  const { selectPayToken } = stockChannel;
  const receiveToken =
    stockChannel.tradeSide === ESwapStockTradeSide.Buy
      ? stockChannel.currentStockToken
      : stockChannel.payToken;
  const sendToken =
    stockChannel.tradeSide === ESwapStockTradeSide.Buy
      ? stockChannel.payToken
      : stockChannel.currentStockToken;
  const quoteMatchesStockTrade = useMemo(
    () =>
      !forceHideQuote &&
      isQuoteResultForStockTrade({
        quoteResult,
        receiveToken,
        sendAmount: fromTokenAmount.value,
        sendToken,
      }),
    [
      forceHideQuote,
      fromTokenAmount.value,
      quoteResult,
      receiveToken,
      sendToken,
    ],
  );
  const quoteToAmount = quoteMatchesStockTrade ? quoteResult?.toAmount : '';
  const receiveAmount =
    quoteToAmount ||
    (!quoteResult && !forceHideQuote ? toTokenAmount.value : '');
  const isLoading = quoteLoading || quoteEventFetching;
  const isSellSide = stockChannel.tradeSide === ESwapStockTradeSide.Sell;
  const canSelectReceiveToken =
    isSellSide && stockChannel.selectablePayTokens.length > 1 && !isLoading;
  const currencySymbol =
    currencyMap[settingsPersistAtom.currencyInfo.id]?.unit ??
    currencyMap[STOCK_PRICE_SOURCE_CURRENCY]?.unit ??
    settingsPersistAtom.currencyInfo.symbol;
  const receiveFiatValue = useMemo(() => {
    const targetCurrency = settingsPersistAtom.currencyInfo.id;
    const quoteTokenPrice = quoteMatchesStockTrade
      ? resolveStockTokenPrice({
          token: quoteResult?.toTokenInfo,
          fallbackCurrency: targetCurrency,
        })
      : undefined;
    const receiveTokenPrice = resolveStockTokenPrice({
      token: receiveToken,
      fallbackCurrency: STOCK_PRICE_SOURCE_CURRENCY,
    });
    return getStockTokenFiatValue({
      amount: receiveAmount,
      tokenPrice: quoteTokenPrice ?? receiveTokenPrice,
      targetCurrency,
      currencyMap,
    });
  }, [
    currencyMap,
    receiveAmount,
    quoteMatchesStockTrade,
    quoteResult?.toTokenInfo,
    receiveToken,
    settingsPersistAtom.currencyInfo.id,
  ]);
  const rateDifference = useMemo(() => {
    if (!quoteMatchesStockTrade) {
      return undefined;
    }
    const targetCurrency = settingsPersistAtom.currencyInfo.id;
    const fromTokenPrice =
      resolveStockTokenPrice({
        token: quoteResult?.fromTokenInfo,
        fallbackCurrency: targetCurrency,
      }) ??
      resolveStockTokenPrice({
        token: sendToken,
        fallbackCurrency: STOCK_PRICE_SOURCE_CURRENCY,
      });
    const toTokenPrice =
      resolveStockTokenPrice({
        token: quoteResult?.toTokenInfo,
        fallbackCurrency: targetCurrency,
      }) ??
      resolveStockTokenPrice({
        token: receiveToken,
        fallbackCurrency: STOCK_PRICE_SOURCE_CURRENCY,
      });
    return buildSwapRateDifference({
      fromTokenPrice: fromTokenPrice?.price,
      toTokenPrice: toTokenPrice?.price,
      fromTokenCurrency: fromTokenPrice?.currency,
      toTokenCurrency: toTokenPrice?.currency,
      currencyMap,
      instantRate: quoteResult?.instantRate,
    });
  }, [
    currencyMap,
    quoteMatchesStockTrade,
    quoteResult?.fromTokenInfo,
    quoteResult?.instantRate,
    quoteResult?.toTokenInfo,
    receiveToken,
    sendToken,
    settingsPersistAtom.currencyInfo.id,
  ]);
  const onReceiveTokenPress = useCallback(
    (token: IToken) => {
      setIsReceiveTokenPopoverOpen(false);
      selectPayToken(token);
    },
    [selectPayToken],
  );

  useEffect(() => {
    if (
      !quoteToAmount ||
      (toTokenAmount.value === quoteToAmount && !toTokenAmount.isInput)
    ) {
      return;
    }
    setToTokenAmount({ value: quoteToAmount, isInput: false });
  }, [
    quoteToAmount,
    setToTokenAmount,
    toTokenAmount.isInput,
    toTokenAmount.value,
  ]);
  useEffect(() => {
    if (!canSelectReceiveToken && isReceiveTokenPopoverOpen) {
      setIsReceiveTokenPopoverOpen(false);
    }
  }, [canSelectReceiveToken, isReceiveTokenPopoverOpen]);

  return {
    canSelectReceiveToken,
    currencySymbol,
    isLoading,
    isSellSide,
    isReceiveTokenPopoverOpen,
    onReceiveTokenPress,
    rateDifference,
    receiveAmount,
    receiveFiatValue,
    receiveToken,
    setIsReceiveTokenPopoverOpen,
  };
}

export function useSwapStockAmountInputState({
  stockChannel,
}: {
  stockChannel: IUseSwapStockChannelReturn;
}) {
  const [fromTokenAmount, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setSwapAlerts] = useSwapAlertsAtom();
  const [fromTokenBalance, setFromTokenBalance] =
    useSwapStockSelectedFromTokenBalanceAtom();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const {
    currentStockToken,
    payToken,
    payTokenStatus,
    payTokens,
    selectablePayTokens,
    payTokenOptionsLoading,
    disableNativePayToken,
    selectPayToken,
    stockTokenStatus,
    tradeSide,
  } = stockChannel;
  const isBuySide = tradeSide === ESwapStockTradeSide.Buy;
  const inputToken = isBuySide ? payToken : currentStockToken;
  const inputTokenStatus = isBuySide ? payTokenStatus : stockTokenStatus;
  const inputTokenVisible = Boolean(inputToken);
  const stockIdentityReady =
    stockTokenStatus === ESwapStockChannelAsyncStatus.Ready;
  const payTokenReady = isStockPayTokenReadyForTradeInput({
    payToken,
    payTokenStatus,
    selectablePayTokens,
    stockIdentityReady,
  });
  const inputTokenReady = isBuySide
    ? payTokenReady
    : stockIdentityReady && inputTokenVisible;
  const stockInputTokenBalance = useStockInputTokenBalance({
    enabled: inputTokenReady,
    token: inputToken,
  });
  const resolvedInputTokenBalance = stockInputTokenBalance.balance ?? '0';
  const displayBalance = useMemo(() => {
    if (stockInputTokenBalance.displayBalance !== undefined) {
      return stockInputTokenBalance.displayBalance;
    }
    if (isBuySide && fromTokenBalance) {
      return fromTokenBalance;
    }
    return '0';
  }, [fromTokenBalance, isBuySide, stockInputTokenBalance.displayBalance]);
  const inputTokenNetworkLogoURI =
    inputToken?.networkLogoURI ?? getNetworkLogoURI(inputToken?.networkId);
  const inputTokenPrice =
    resolveStockTokenPrice({
      token: stockInputTokenBalance.tokenDetail,
      fallbackCurrency: STOCK_PRICE_SOURCE_CURRENCY,
    }) ??
    resolveStockTokenPrice({
      token: inputToken,
      fallbackCurrency: STOCK_PRICE_SOURCE_CURRENCY,
    });
  const amountFiatValue = useMemo(() => {
    return getStockTokenFiatValue({
      amount: fromTokenAmount.value,
      tokenPrice: inputTokenPrice,
      targetCurrency: settingsPersistAtom.currencyInfo.id,
      currencyMap,
    });
  }, [
    currencyMap,
    fromTokenAmount.value,
    inputTokenPrice,
    settingsPersistAtom.currencyInfo.id,
  ]);
  const currencySymbol =
    currencyMap[settingsPersistAtom.currencyInfo.id]?.unit ??
    currencyMap[STOCK_PRICE_SOURCE_CURRENCY]?.unit ??
    settingsPersistAtom.currencyInfo.symbol;
  const onAmountChange = useCallback(
    (value: string) => {
      if (validateAmountInput(value, inputToken?.decimals)) {
        setSwapAlerts({
          quoteId: '',
          states: [],
        });
        setFromTokenAmount({
          value,
          isInput: true,
        });
      }
    },
    [inputToken?.decimals, setFromTokenAmount, setSwapAlerts],
  );
  const setInputAmount = useCallback(
    (amount: BigNumber) => {
      if (!inputToken || !amount.isFinite() || amount.isNaN()) {
        return;
      }
      const amountValue = amount
        .decimalPlaces(Number(inputToken.decimals ?? 6), BigNumber.ROUND_DOWN)
        .toFixed();
      if (!validateAmountInput(amountValue, inputToken.decimals)) {
        return;
      }
      setSwapAlerts({
        quoteId: '',
        states: [],
      });
      setFromTokenAmount({
        value: amountValue,
        isInput: true,
      });
    },
    [inputToken, setFromTokenAmount, setSwapAlerts],
  );
  const onBalanceMaxPress = useCallback(() => {
    if (stockInputTokenBalance.balance === undefined) {
      return;
    }
    setInputAmount(new BigNumber(resolvedInputTokenBalance));
  }, [
    resolvedInputTokenBalance,
    setInputAmount,
    stockInputTokenBalance.balance,
  ]);
  const onSelectPercentageStage = useCallback(
    (stage: number) => {
      if (stockInputTokenBalance.balance === undefined) {
        return;
      }
      const balanceBN = new BigNumber(resolvedInputTokenBalance);
      setInputAmount(balanceBN.multipliedBy(stage / 100));
    },
    [resolvedInputTokenBalance, setInputAmount, stockInputTokenBalance.balance],
  );
  const hasBalanceError = useMemo(() => {
    if (!isBuySide || !inputToken) {
      return false;
    }
    if (stockInputTokenBalance.balance === undefined) {
      return false;
    }
    const balanceBN = new BigNumber(resolvedInputTokenBalance);
    const amountBN = new BigNumber(fromTokenAmount.value ?? '0');
    if (
      balanceBN.isNaN() ||
      amountBN.isNaN() ||
      !balanceBN.isFinite() ||
      !amountBN.isFinite()
    ) {
      return false;
    }
    return amountBN.gt(balanceBN);
  }, [
    fromTokenAmount.value,
    inputToken,
    isBuySide,
    resolvedInputTokenBalance,
    stockInputTokenBalance.balance,
  ]);

  useEffect(() => {
    if (!inputTokenReady || stockInputTokenBalance.balance === undefined) {
      return;
    }
    if (fromTokenBalance === resolvedInputTokenBalance) {
      return;
    }
    setFromTokenBalance(resolvedInputTokenBalance);
  }, [
    fromTokenBalance,
    inputTokenReady,
    resolvedInputTokenBalance,
    setFromTokenBalance,
    stockInputTokenBalance.balance,
  ]);

  return {
    amountFiatValue,
    balanceLoading: stockInputTokenBalance.loading,
    currencySymbol,
    disableNativePayToken,
    displayBalance,
    hasBalanceError,
    inputToken,
    inputTokenNetworkLogoURI,
    inputValue: fromTokenAmount.value,
    isBuySide,
    onBalanceMaxPress,
    onAmountChange,
    onSelectPercentageStage,
    payToken,
    payTokenOptionsLoading,
    payTokens,
    selectablePayTokens,
    selectPayToken,
    shouldRenderSkeleton: shouldRenderStockTradeInputSkeleton({
      inputTokenStatus,
      inputTokenReady,
      inputTokenVisible,
      isBuySide,
    }),
  };
}
