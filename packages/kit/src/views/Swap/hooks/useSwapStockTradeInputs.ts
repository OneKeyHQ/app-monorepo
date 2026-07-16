import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSwapAlertsAtom,
  useSwapFromTokenAmountAtom,
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
import { buildSwapSelectedTokensColdStartAccountKey } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  EProtocolOfExchange,
  type IFetchQuoteResult,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { buildSwapRateDifference } from '../utils/swapRateDifferenceUtils';

import {
  getTokenIdentityKey,
  getValidStockExecutionBalance,
  isStockExecutionBalancePublished,
  isStockExecutionBalanceScopeReady,
  isStockPayTokenReadyForTradeInput,
  resolveStockDisplayBalance,
  shouldRenderStockTradeInputSkeleton,
} from './swapStockChannelUtils';
import {
  buildStockExecutionBalanceScope,
  buildStockExecutionNetworkAccountScope,
  runStockExecutionBalanceRequestWithRetry,
} from './swapStockExecutionBalanceUtils';
import {
  STOCK_PRICE_SOURCE_CURRENCY,
  getStockTokenFiatValue,
  markStockUsdPriceCurrency,
  resolveStockTokenPrice,
} from './swapStockFiatValueUtils';
import { resolveStockEstimatedReceiveQuoteState } from './swapStockQuoteUtils';
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
  return getTokenIdentityKey(token);
}

function useStockInputTokenBalance({
  displayIdentityKey,
  enabled,
  token,
}: {
  displayIdentityKey: string;
  enabled: boolean;
  token?: ISwapToken;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const tokenScope = getStockInputTokenIdentityKey(token);
  const activeOwnerAccountId =
    activeAccount?.indexedAccount?.id ??
    activeAccount?.account?.id ??
    activeAccount?.dbAccount?.id;
  const hasActiveAccountOwner = Boolean(activeOwnerAccountId);
  const accountKey = activeAccount.ready
    ? buildSwapSelectedTokensColdStartAccountKey(activeAccount)
    : undefined;
  const tokenNetworkId = token?.networkId ?? '';
  const accountNetworkReady = Boolean(
    activeAccount.ready && accountKey && hasActiveAccountOwner,
  );
  const shouldFetchNetworkAccount = Boolean(
    enabled && tokenNetworkId && accountNetworkReady,
  );
  const networkAccountScope = buildStockExecutionNetworkAccountScope({
    accountKey,
    displayIdentityKey,
    enabled: shouldFetchNetworkAccount,
    networkId: tokenNetworkId,
    refreshKey,
  });
  const latestNetworkAccountScopeRef = useRef(networkAccountScope);
  latestNetworkAccountScopeRef.current = networkAccountScope;
  useEffect(
    () => () => {
      if (latestNetworkAccountScopeRef.current === networkAccountScope) {
        latestNetworkAccountScopeRef.current = '';
      }
    },
    [networkAccountScope],
  );
  const { result: networkAccountState, isLoading: networkAccountLoading } =
    usePromiseResult(
      async () => {
        if (!shouldFetchNetworkAccount || !tokenNetworkId) {
          return {
            scope: networkAccountScope,
            account: null,
            failed: false,
          };
        }
        try {
          const account = await runStockExecutionBalanceRequestWithRetry({
            request: async () => {
              const defaultDeriveType =
                await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                  {
                    networkId: tokenNetworkId,
                  },
                );
              return backgroundApiProxy.serviceAccount.getNetworkAccount({
                accountId: activeAccount?.indexedAccount?.id
                  ? undefined
                  : (activeAccount?.account?.id ??
                    activeAccount?.dbAccount?.id),
                dbAccount: activeAccount?.dbAccount,
                indexedAccountId: activeAccount?.indexedAccount?.id ?? '',
                networkId: tokenNetworkId,
                deriveType: defaultDeriveType ?? 'default',
              });
            },
            isUsable: (value) => Boolean(value?.id && value.address),
            shouldContinue: () =>
              latestNetworkAccountScopeRef.current === networkAccountScope,
          });
          return {
            scope: networkAccountScope,
            account: account ?? null,
            failed: !account,
          };
        } catch {
          return {
            scope: networkAccountScope,
            account: null,
            failed: true,
          };
        }
      },
      [
        activeAccount?.account?.id,
        activeAccount?.dbAccount,
        activeAccount?.indexedAccount?.id,
        networkAccountScope,
        shouldFetchNetworkAccount,
        tokenNetworkId,
      ],
      {
        initResult: {
          scope: '',
          account: null,
          failed: false,
        },
        watchLoading: shouldFetchNetworkAccount,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
      },
    );
  const networkAccountReady =
    !shouldFetchNetworkAccount ||
    networkAccountState.scope === networkAccountScope;
  const landedNetworkAccount =
    shouldFetchNetworkAccount && networkAccountReady
      ? networkAccountState.account
      : null;
  const lastGoodNetworkAccountRef = useRef<
    | {
        scope: string;
        account: { id: string; address: string };
      }
    | undefined
  >(undefined);
  if (landedNetworkAccount?.id && landedNetworkAccount.address) {
    lastGoodNetworkAccountRef.current = {
      scope: networkAccountScope,
      account: {
        id: landedNetworkAccount.id,
        address: landedNetworkAccount.address,
      },
    };
  }
  const networkAccount =
    landedNetworkAccount ??
    (lastGoodNetworkAccountRef.current?.scope === networkAccountScope
      ? lastGoodNetworkAccountRef.current.account
      : null);
  const networkAccountFailed = Boolean(
    shouldFetchNetworkAccount &&
    networkAccountReady &&
    networkAccountState.failed &&
    !networkAccount,
  );
  const { requestScope: balanceScope } = buildStockExecutionBalanceScope({
    accountAddress: networkAccount?.address,
    accountId: networkAccount?.id,
    displayIdentityKey,
    networkAccountReady,
    refreshKey,
    tokenScope,
  });
  const latestBalanceScopeRef = useRef(balanceScope);
  latestBalanceScopeRef.current = balanceScope;
  useEffect(
    () => () => {
      if (latestBalanceScopeRef.current === balanceScope) {
        latestBalanceScopeRef.current = '';
      }
    },
    [balanceScope],
  );
  const shouldWaitForNetworkAccount =
    Boolean(enabled && tokenNetworkId && !accountNetworkReady) ||
    (shouldFetchNetworkAccount && !networkAccountReady);
  const { result: detailState, isLoading: detailLoading } = usePromiseResult(
    async () => {
      if (!enabled || !token || shouldWaitForNetworkAccount) {
        return {
          scope: balanceScope,
          balance: undefined as string | undefined,
          tokenDetail: undefined as ISwapToken | undefined,
          failed: false,
        };
      }
      if (networkAccountFailed) {
        return {
          scope: balanceScope,
          balance: undefined as string | undefined,
          tokenDetail: undefined as ISwapToken | undefined,
          failed: true,
        };
      }
      if (!networkAccount) {
        return {
          scope: balanceScope,
          balance: undefined as string | undefined,
          tokenDetail: undefined as ISwapToken | undefined,
          failed: true,
        };
      }
      try {
        const detail = await runStockExecutionBalanceRequestWithRetry({
          request: async () => {
            const details =
              await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
                protocol: EProtocolOfExchange.STOCK,
                networkId: token.networkId,
                contractAddress: token.contractAddress,
                accountId: networkAccount.id,
                accountAddress: networkAccount.address,
                currency: 'usd',
              });
            return details?.[0];
          },
          isUsable: (value) =>
            getValidStockExecutionBalance(value?.balanceParsed) !== undefined,
          shouldContinue: () => latestBalanceScopeRef.current === balanceScope,
        });
        const liveBalance = getValidStockExecutionBalance(
          detail?.balanceParsed,
        );
        if (!detail || liveBalance === undefined) {
          return {
            scope: balanceScope,
            balance: undefined as string | undefined,
            tokenDetail: undefined as ISwapToken | undefined,
            failed: true,
          };
        }
        return {
          scope: balanceScope,
          balance: liveBalance,
          tokenDetail: markStockUsdPriceCurrency(detail),
          failed: false,
        };
      } catch {
        // A display snapshot may stay visible, but a failed request must not
        // manufacture a live execution balance from stale token metadata.
        return {
          scope: balanceScope,
          balance: undefined as string | undefined,
          tokenDetail: undefined as ISwapToken | undefined,
          failed: true,
        };
      }
    },
    [
      balanceScope,
      enabled,
      networkAccount,
      networkAccountFailed,
      shouldWaitForNetworkAccount,
      token,
    ],
    {
      initResult: {
        scope: '',
        balance: undefined as string | undefined,
        tokenDetail: undefined as ISwapToken | undefined,
        failed: false,
      },
      watchLoading: enabled,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
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

  const balanceSettled = detailState.scope === balanceScope;
  const balanceReady = balanceSettled && detailState.balance !== undefined;
  const retryBalance = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  return {
    balance: balanceReady ? detailState.balance : undefined,
    displayIdentityKey,
    failed:
      enabled &&
      balanceSettled &&
      detailState.failed &&
      !networkAccountLoading &&
      !detailLoading,
    inputTokenKey: tokenScope,
    tokenDetail: balanceReady ? detailState.tokenDetail : undefined,
    loading:
      enabled &&
      Boolean(
        token &&
        (!balanceSettled ||
          networkAccountLoading ||
          shouldWaitForNetworkAccount ||
          detailLoading),
      ),
    retry: retryBalance,
  };
}

export function useSwapStockEstimatedReceiveState({
  displayQuoteResult,
  forceHideQuote,
  quoteResult,
  quoteLoading,
  quoteEventFetching,
  stockChannel,
}: {
  displayQuoteResult?: IFetchQuoteResult;
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
  const { displayQuote, executionQuoteToAmount } = useMemo(
    () =>
      resolveStockEstimatedReceiveQuoteState({
        displayQuoteResult,
        executionQuoteResult: quoteResult,
        forceHideQuote,
        receiveToken,
        sendAmount: fromTokenAmount.value,
        sendToken,
      }),
    [
      displayQuoteResult,
      forceHideQuote,
      fromTokenAmount.value,
      quoteResult,
      receiveToken,
      sendToken,
    ],
  );
  const quoteRequestLoading = quoteLoading || quoteEventFetching;
  const receiveAmount =
    displayQuote?.toAmount ||
    (!displayQuote && !forceHideQuote && !quoteRequestLoading
      ? toTokenAmount.value
      : '');
  const isLoading = !forceHideQuote && quoteRequestLoading && !displayQuote;
  const isSellSide = stockChannel.tradeSide === ESwapStockTradeSide.Sell;
  const canSelectReceiveToken =
    isSellSide &&
    stockChannel.selectablePayTokens.length > 1 &&
    !quoteRequestLoading;
  const currencySymbol =
    currencyMap[settingsPersistAtom.currencyInfo.id]?.unit ??
    currencyMap[STOCK_PRICE_SOURCE_CURRENCY]?.unit ??
    settingsPersistAtom.currencyInfo.symbol;
  const receiveFiatValue = useMemo(() => {
    const targetCurrency = settingsPersistAtom.currencyInfo.id;
    const quoteTokenPrice = resolveStockTokenPrice({
      token: displayQuote?.toTokenInfo,
      fallbackCurrency: targetCurrency,
    });
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
    displayQuote?.toTokenInfo,
    receiveAmount,
    receiveToken,
    settingsPersistAtom.currencyInfo.id,
  ]);
  const rateDifference = useMemo(() => {
    if (!displayQuote) {
      return undefined;
    }
    const targetCurrency = settingsPersistAtom.currencyInfo.id;
    const fromTokenPrice =
      resolveStockTokenPrice({
        token: displayQuote?.fromTokenInfo,
        fallbackCurrency: targetCurrency,
      }) ??
      resolveStockTokenPrice({
        token: sendToken,
        fallbackCurrency: STOCK_PRICE_SOURCE_CURRENCY,
      });
    const toTokenPrice =
      resolveStockTokenPrice({
        token: displayQuote?.toTokenInfo,
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
      instantRate: displayQuote?.instantRate,
    });
  }, [
    currencyMap,
    displayQuote,
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
      !executionQuoteToAmount ||
      (toTokenAmount.value === executionQuoteToAmount && !toTokenAmount.isInput)
    ) {
      return;
    }
    setToTokenAmount({ value: executionQuoteToAmount, isInput: false });
  }, [
    executionQuoteToAmount,
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
    useSwapSelectedFromTokenBalanceAtom();
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
    marketStatusStatus,
    selectPayToken,
    stockDisplay,
    stockTokenStatus,
    tradeSide,
  } = stockChannel;
  const commitStockDisplaySnapshotPatch = stockDisplay.commitSnapshotPatch;
  const stockDisplayIdentityKey = stockDisplay.identityKey;
  const isBuySide = tradeSide === ESwapStockTradeSide.Buy;
  const inputToken = isBuySide ? payToken : currentStockToken;
  const inputTokenVisible = Boolean(inputToken);
  const stockIdentityReady =
    stockTokenStatus === ESwapStockChannelAsyncStatus.Ready &&
    marketStatusStatus === ESwapStockChannelAsyncStatus.Ready;
  const payTokenReady = isStockPayTokenReadyForTradeInput({
    payToken,
    payTokenStatus,
    selectablePayTokens,
    stockIdentityReady,
  });
  const inputTokenReady = isBuySide
    ? payTokenReady
    : stockIdentityReady && inputTokenVisible;
  const executionBalanceFetchEnabled = Boolean(
    inputTokenVisible && stockDisplayIdentityKey,
  );
  const stockInputTokenBalance = useStockInputTokenBalance({
    displayIdentityKey: stockDisplayIdentityKey,
    enabled: executionBalanceFetchEnabled,
    token: inputToken,
  });
  const inputTokenKey = getStockInputTokenIdentityKey(inputToken);
  const snapshotBalance =
    stockDisplay.snapshot?.balance?.inputTokenKey === inputTokenKey
      ? stockDisplay.snapshot.balance
      : undefined;
  const liveBalanceReadyForExecution = isStockExecutionBalanceScopeReady({
    balance: stockInputTokenBalance.balance,
    displayIdentityKey: stockInputTokenBalance.displayIdentityKey,
    expectedIdentityKey: stockDisplayIdentityKey,
    inputTokenKey,
    loading: stockInputTokenBalance.loading || !inputTokenReady,
  });
  const balanceReadyForExecution = isStockExecutionBalancePublished({
    balance: stockInputTokenBalance.balance,
    liveScopeReady: liveBalanceReadyForExecution,
    publishedBalance: fromTokenBalance,
  });
  const displayBalance = resolveStockDisplayBalance({
    liveBalance: stockInputTokenBalance.balance,
    snapshotBalance: snapshotBalance?.value,
  });
  const inputTokenNetworkLogoURI =
    inputToken?.networkLogoURI ?? getNetworkLogoURI(inputToken?.networkId);
  const inputTokenPrice =
    resolveStockTokenPrice({
      token: stockInputTokenBalance.tokenDetail,
      fallbackCurrency: STOCK_PRICE_SOURCE_CURRENCY,
    }) ??
    snapshotBalance?.tokenPrice ??
    (isBuySide
      ? undefined
      : resolveStockTokenPrice({
          token: stockDisplay.displayTokenDetail,
          fallbackCurrency: STOCK_PRICE_SOURCE_CURRENCY,
        })) ??
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
    if (
      !balanceReadyForExecution ||
      stockInputTokenBalance.balance === undefined
    ) {
      return;
    }
    setInputAmount(new BigNumber(stockInputTokenBalance.balance));
  }, [
    balanceReadyForExecution,
    setInputAmount,
    stockInputTokenBalance.balance,
  ]);
  const onSelectPercentageStage = useCallback(
    (stage: number) => {
      if (
        !balanceReadyForExecution ||
        stockInputTokenBalance.balance === undefined
      ) {
        return;
      }
      const balanceBN = new BigNumber(stockInputTokenBalance.balance);
      setInputAmount(balanceBN.multipliedBy(stage / 100));
    },
    [balanceReadyForExecution, setInputAmount, stockInputTokenBalance.balance],
  );
  const hasBalanceError = useMemo(() => {
    if (
      !isBuySide ||
      !inputToken ||
      !balanceReadyForExecution ||
      stockInputTokenBalance.balance === undefined
    ) {
      return false;
    }
    const balanceBN = new BigNumber(stockInputTokenBalance.balance);
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
    balanceReadyForExecution,
    fromTokenAmount.value,
    inputToken,
    isBuySide,
    stockInputTokenBalance.balance,
  ]);

  const liveTokenPrice = useMemo(
    () =>
      resolveStockTokenPrice({
        token: stockInputTokenBalance.tokenDetail,
        fallbackCurrency: STOCK_PRICE_SOURCE_CURRENCY,
      }),
    [stockInputTokenBalance.tokenDetail],
  );
  const canonicalBalanceScope = `${stockDisplayIdentityKey}:${inputTokenKey}`;
  useEffect(() => {
    // The atom is shared with generic Swap actions. Invalidate it whenever the
    // Stock execution owner changes so an old account balance cannot unlock a
    // new account/pair before its exact live balance lands.
    setFromTokenBalance('');
  }, [canonicalBalanceScope, setFromTokenBalance]);
  useEffect(() => {
    if (
      !stockDisplayIdentityKey ||
      !inputTokenKey ||
      stockInputTokenBalance.balance === undefined ||
      stockInputTokenBalance.displayIdentityKey !== stockDisplayIdentityKey
    ) {
      return;
    }
    commitStockDisplaySnapshotPatch({
      expectedIdentityKey: stockInputTokenBalance.displayIdentityKey,
      patch: {
        balance: {
          inputTokenKey,
          value: stockInputTokenBalance.balance,
          tokenPrice: liveTokenPrice,
        },
      },
    });
  }, [
    inputTokenKey,
    liveTokenPrice,
    commitStockDisplaySnapshotPatch,
    stockInputTokenBalance.balance,
    stockInputTokenBalance.displayIdentityKey,
    stockDisplayIdentityKey,
  ]);

  useEffect(() => {
    if (
      !inputTokenReady ||
      !liveBalanceReadyForExecution ||
      stockInputTokenBalance.balance === undefined ||
      stockInputTokenBalance.displayIdentityKey !== stockDisplayIdentityKey
    ) {
      return;
    }
    if (fromTokenBalance === stockInputTokenBalance.balance) {
      return;
    }
    setFromTokenBalance(stockInputTokenBalance.balance);
  }, [
    fromTokenBalance,
    inputTokenReady,
    liveBalanceReadyForExecution,
    setFromTokenBalance,
    stockInputTokenBalance.balance,
    stockInputTokenBalance.displayIdentityKey,
    stockDisplayIdentityKey,
  ]);

  return {
    amountFiatValue,
    balanceFailed: stockInputTokenBalance.failed,
    balanceLoading: !snapshotBalance && stockInputTokenBalance.loading,
    balanceReadyForExecution,
    currencySymbol,
    disableNativePayToken,
    displayBalance,
    hasBalanceError,
    inputToken,
    inputTokenNetworkLogoURI,
    inputValue: fromTokenAmount.value,
    isBuySide,
    onBalanceMaxPress,
    onBalanceRetry: stockInputTokenBalance.retry,
    onAmountChange,
    onSelectPercentageStage,
    payToken,
    payTokenOptionsLoading,
    payTokens,
    selectablePayTokens,
    selectPayToken,
    shouldRenderSkeleton: shouldRenderStockTradeInputSkeleton({
      inputTokenReady,
      inputTokenVisible,
      isBuySide,
    }),
  };
}
