import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSwapFromTokenAmountAtom,
  useSwapSelectTokenDetailFetchingAtom,
  useSwapSelectedFromTokenBalanceAtom,
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
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { buildSwapRateDifference } from '../utils/swapRateDifferenceUtils';

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
  const [refreshKey, setRefreshKey] = useState(0);
  const tokenScope = getStockInputTokenIdentityKey(token);
  const hasActiveAccount = Boolean(
    activeAccount?.indexedAccount?.id || activeAccount?.account?.id,
  );
  const shouldFetchNetworkAccount = Boolean(
    enabled && token?.networkId && hasActiveAccount,
  );
  const networkAccountScope = `${shouldFetchNetworkAccount ? '1' : '0'}:${
    token?.networkId ?? ''
  }:${activeAccount?.indexedAccount?.id ?? ''}:${
    activeAccount?.account?.id ?? ''
  }`;
  const { result: networkAccountState, isLoading: networkAccountLoading } =
    usePromiseResult(
      async () => {
        if (!shouldFetchNetworkAccount || !token?.networkId) {
          return {
            scope: networkAccountScope,
            account: null,
          };
        }
        const defaultDeriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId: token.networkId,
          });
        const account =
          await backgroundApiProxy.serviceAccount.getNetworkAccount({
            accountId: activeAccount?.indexedAccount?.id
              ? undefined
              : activeAccount?.account?.id,
            indexedAccountId: activeAccount?.indexedAccount?.id ?? '',
            networkId: token.networkId,
            deriveType: defaultDeriveType ?? 'default',
          });
        return {
          scope: networkAccountScope,
          account,
        };
      },
      [
        activeAccount?.account?.id,
        activeAccount?.indexedAccount?.id,
        networkAccountScope,
        shouldFetchNetworkAccount,
        token?.networkId,
      ],
      {
        initResult: {
          scope: '',
          account: null,
        },
        watchLoading: shouldFetchNetworkAccount,
      },
    );
  const networkAccountReady = networkAccountState.scope === networkAccountScope;
  const networkAccount = networkAccountReady
    ? networkAccountState.account
    : null;
  const balanceScope = `${tokenScope}:${networkAccountReady ? 'ready' : 'pending'}:${
    networkAccount?.id ?? ''
  }:${networkAccount?.address ?? ''}:${refreshKey}`;
  const shouldWaitForNetworkAccount =
    shouldFetchNetworkAccount && !networkAccountReady;
  const { result: detailState, isLoading: detailLoading } = usePromiseResult(
    async () => {
      if (!enabled || !token || shouldWaitForNetworkAccount) {
        return {
          scope: balanceScope,
          balance: undefined as string | undefined,
          tokenDetail: undefined as ISwapToken | undefined,
        };
      }
      if (!networkAccount) {
        return {
          scope: balanceScope,
          balance: token.balanceParsed ?? '0',
          tokenDetail: token,
        };
      }
      const details =
        await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
          networkId: token.networkId,
          contractAddress: token.contractAddress,
          accountId: networkAccount.id,
          accountAddress: networkAccount.address,
          currency: 'usd',
        });
      return {
        scope: balanceScope,
        balance: details?.[0]?.balanceParsed ?? token.balanceParsed ?? '0',
        tokenDetail: markStockUsdPriceCurrency(details?.[0]),
      };
    },
    [balanceScope, enabled, networkAccount, shouldWaitForNetworkAccount, token],
    {
      initResult: {
        scope: '',
        balance: undefined as string | undefined,
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

  const balanceReady =
    detailState.scope === balanceScope && detailState.balance !== undefined;

  return {
    balance: balanceReady ? detailState.balance : undefined,
    tokenDetail: balanceReady ? detailState.tokenDetail : undefined,
    loading:
      enabled &&
      Boolean(
        token &&
        (!balanceReady ||
          networkAccountLoading ||
          shouldWaitForNetworkAccount ||
          detailLoading),
      ),
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
  const [fromTokenBalance, setFromTokenBalance] =
    useSwapSelectedFromTokenBalanceAtom();
  const [swapTokenDetailLoading] = useSwapSelectTokenDetailFetchingAtom();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const {
    currentStockToken,
    payToken,
    payTokens,
    selectablePayTokens,
    payTokenOptionsLoading,
    disableNativePayToken,
    marketStatusStatus,
    selectPayToken,
    speedConfigReady,
    stockTokenStatus,
    tradeSide,
  } = stockChannel;
  const isBuySide = tradeSide === ESwapStockTradeSide.Buy;
  const inputToken = isBuySide ? payToken : currentStockToken;
  const stockIdentityReady =
    stockTokenStatus === ESwapStockChannelAsyncStatus.Ready &&
    marketStatusStatus === ESwapStockChannelAsyncStatus.Ready;
  const payTokenReady =
    !isBuySide ||
    Boolean(
      stockIdentityReady &&
      speedConfigReady &&
      payToken &&
      selectablePayTokens.some((token) =>
        equalTokenNoCaseSensitive({ token1: token, token2: payToken }),
      ),
    );
  const inputTokenReady = isBuySide
    ? payTokenReady
    : stockIdentityReady && Boolean(inputToken);
  const stockInputTokenBalance = useStockInputTokenBalance({
    enabled: inputTokenReady,
    token: inputToken,
  });
  const resolvedInputTokenBalance =
    stockInputTokenBalance.balance ?? inputToken?.balanceParsed ?? '0';
  const displayBalance = useMemo(() => {
    if (stockInputTokenBalance.balance !== undefined) {
      return stockInputTokenBalance.balance;
    }
    if (isBuySide && fromTokenBalance) {
      return fromTokenBalance;
    }
    return inputToken?.balanceParsed ?? '0';
  }, [
    fromTokenBalance,
    inputToken?.balanceParsed,
    isBuySide,
    stockInputTokenBalance.balance,
  ]);
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
        setFromTokenAmount({
          value,
          isInput: true,
        });
      }
    },
    [inputToken?.decimals, setFromTokenAmount],
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
      setFromTokenAmount({
        value: amountValue,
        isInput: true,
      });
    },
    [inputToken, setFromTokenAmount],
  );
  const onBalanceMaxPress = useCallback(() => {
    setInputAmount(new BigNumber(displayBalance ?? '0'));
  }, [displayBalance, setInputAmount]);
  const onSelectPercentageStage = useCallback(
    (stage: number) => {
      const balanceBN = new BigNumber(displayBalance ?? '0');
      setInputAmount(balanceBN.multipliedBy(stage / 100));
    },
    [displayBalance, setInputAmount],
  );
  const hasBalanceError = useMemo(() => {
    if (!isBuySide || !inputToken) {
      return false;
    }
    const balanceBN = new BigNumber(displayBalance ?? '0');
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
  }, [displayBalance, fromTokenAmount.value, inputToken, isBuySide]);

  useEffect(() => {
    if (!inputTokenReady || stockInputTokenBalance.loading) {
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
    stockInputTokenBalance.loading,
  ]);

  return {
    amountFiatValue,
    balanceLoading:
      swapTokenDetailLoading.from || stockInputTokenBalance.loading,
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
    shouldRenderSkeleton: !inputTokenReady,
  };
}
