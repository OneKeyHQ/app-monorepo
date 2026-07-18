import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapAlertsAtom,
  useSwapFromTokenAmountAtom,
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

import { buildSwapRateDifference } from '../utils/swapRateDifferenceUtils';

import {
  getTokenIdentityKey,
  getValidStockExecutionBalance,
  isStockCanonicalInputOwnerReady,
  isStockExecutionBalancePublished,
  isStockExecutionBalanceScopeReady,
  isStockPayTokenReadyForTradeInput,
  resolveStockDisplayBalance,
  shouldRenderStockTradeInputSkeleton,
} from './swapStockChannelUtils';
import { resolveStockSnapshotBalanceForDisplay } from './swapStockDisplayBalanceUtils';
import { swapStockDisplaySnapshotStorage } from './swapStockDisplaySnapshotStorage';
import {
  buildStockExecutionBalanceScope,
  buildStockExecutionNetworkAccountScope,
  runStockExecutionBalanceRequest,
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

import type {
  ISwapStockDisplayAmountIdentity,
  ISwapStockDisplayBalanceSnapshot,
  ISwapStockDisplaySelectionSnapshot,
  ISwapStockDisplayTokenDescriptor,
} from './swapStockDisplaySnapshotUtils';

export type IStockAmountAtomOwnerState = {
  ownerKey?: string;
  identity?: ISwapStockDisplayAmountIdentity;
  initialized: boolean;
  hasResolvedOwner?: boolean;
};

export function buildStockAmountQuoteIntent(value: string) {
  return { value, isInput: true } as const;
}

export function isStockAmountInputEditable({
  amountOwnerKey,
  canonicalOwnerReady,
}: {
  amountOwnerKey: string;
  canonicalOwnerReady: boolean;
}) {
  return Boolean(amountOwnerKey && canonicalOwnerReady);
}

function materializeStockDisplayToken(
  token?: ISwapStockDisplayTokenDescriptor,
): ISwapToken | undefined {
  if (!token) {
    return undefined;
  }
  return {
    ...token,
    // Native-token snapshots deliberately allow a missing address. UI token
    // consumers still expect the canonical ISwapToken shape.
    contractAddress: token.contractAddress ?? '',
  };
}

export function resolveStockAmountInputTokens({
  currentStockToken,
  payToken,
  selection,
  tradeSide,
}: {
  currentStockToken?: ISwapToken;
  payToken?: ISwapToken;
  selection?: ISwapStockDisplaySelectionSnapshot;
  tradeSide: ESwapStockTradeSide;
}) {
  const isBuySide = tradeSide === ESwapStockTradeSide.Buy;
  const executionInputToken = isBuySide ? payToken : currentStockToken;
  const currentStockTokenKey = getTokenIdentityKey(currentStockToken);
  const selectionStockTokenKey = getTokenIdentityKey(selection?.stockToken);
  const selectionMatchesCurrentOwner = Boolean(
    selection?.tradeSide === tradeSide &&
    selectionStockTokenKey &&
    (!currentStockTokenKey || selectionStockTokenKey === currentStockTokenKey),
  );
  let restoredInputToken: ISwapStockDisplayTokenDescriptor | undefined;
  if (selectionMatchesCurrentOwner) {
    restoredInputToken = isBuySide
      ? selection?.payToken
      : selection?.stockToken;
  }

  return {
    executionInputToken,
    displayInputToken:
      executionInputToken ?? materializeStockDisplayToken(restoredInputToken),
  };
}

export function resolveStockAmountDisplayOwnerKey({
  amountIdentity,
  amountOwnerKey,
  currentStockToken,
  payToken,
  tradeSide,
}: {
  amountIdentity?: ISwapStockDisplayAmountIdentity;
  amountOwnerKey: string;
  currentStockToken?: ISwapToken;
  payToken?: ISwapToken;
  tradeSide: ESwapStockTradeSide;
}) {
  if (
    !amountIdentity ||
    !amountOwnerKey ||
    amountIdentity.tradeSide !== tradeSide
  ) {
    return '';
  }
  const currentStockTokenKey = getTokenIdentityKey(currentStockToken);
  if (
    currentStockTokenKey &&
    currentStockTokenKey !== amountIdentity.stockTokenKey
  ) {
    return '';
  }
  const payTokenKey = getTokenIdentityKey(payToken);
  if (payTokenKey && payTokenKey !== amountIdentity.payTokenKey) {
    return '';
  }
  return amountOwnerKey;
}

export function resolveStockAmountInputValue({
  amountAtomOwnerState,
  amountOwnerKey,
  atomValue,
  restoredValue,
}: {
  amountAtomOwnerState: IStockAmountAtomOwnerState;
  amountOwnerKey: string;
  atomValue: string;
  restoredValue?: string;
}) {
  if (
    amountOwnerKey &&
    amountAtomOwnerState.ownerKey === amountOwnerKey &&
    amountAtomOwnerState.initialized
  ) {
    return atomValue;
  }
  if (amountOwnerKey && restoredValue !== undefined) {
    return restoredValue;
  }
  return '';
}

export function resolveStockAmountOwnerTransition({
  amountAtomOwnerState,
  atomValue,
  nextIdentity,
  nextOwnerKey,
  restoredValue,
}: {
  amountAtomOwnerState: IStockAmountAtomOwnerState;
  atomValue: string;
  nextIdentity?: ISwapStockDisplayAmountIdentity;
  nextOwnerKey: string;
  restoredValue?: string;
}) {
  const ownerChanged = amountAtomOwnerState.ownerKey !== nextOwnerKey;
  const hadResolvedOwner =
    amountAtomOwnerState.hasResolvedOwner ??
    Boolean(amountAtomOwnerState.ownerKey);
  const hasNextOwner = Boolean(nextOwnerKey && nextIdentity);
  const shouldPreserveInput = Boolean(
    ownerChanged &&
    hadResolvedOwner &&
    amountAtomOwnerState.initialized &&
    nextIdentity &&
    amountAtomOwnerState.identity &&
    amountAtomOwnerState.identity.accountKey === nextIdentity.accountKey &&
    amountAtomOwnerState.identity.tradeSide === nextIdentity.tradeSide &&
    (amountAtomOwnerState.identity.stockTokenKey !==
      nextIdentity.stockTokenKey ||
      amountAtomOwnerState.identity.payTokenKey !== nextIdentity.payTokenKey),
  );
  const isFirstResolvedOwner = Boolean(hasNextOwner && !hadResolvedOwner);
  const atomValueAfterTransition = shouldPreserveInput ? atomValue : '';
  let displayValue = '';
  if (shouldPreserveInput) {
    displayValue = atomValue;
  } else if (isFirstResolvedOwner) {
    displayValue = restoredValue ?? '';
  }

  return {
    atomValue: atomValueAfterTransition,
    displayValue,
    nextState: {
      ownerKey: nextOwnerKey,
      identity: nextIdentity ?? amountAtomOwnerState.identity,
      initialized: Boolean(
        shouldPreserveInput || (hasNextOwner && hadResolvedOwner),
      ),
      hasResolvedOwner: hadResolvedOwner || hasNextOwner,
    } satisfies IStockAmountAtomOwnerState,
    ownerChanged,
    shouldCommitSnapshot: Boolean(hasNextOwner && hadResolvedOwner),
    shouldPreserveInput,
  };
}

export function markStockAmountOwnerInitialized({
  amountAtomOwnerState,
  amountIdentity,
  amountOwnerKey,
}: {
  amountAtomOwnerState: IStockAmountAtomOwnerState;
  amountIdentity?: ISwapStockDisplayAmountIdentity;
  amountOwnerKey: string;
}) {
  const resolvedIdentity = amountIdentity ?? amountAtomOwnerState.identity;
  return {
    ...amountAtomOwnerState,
    ownerKey: amountOwnerKey,
    identity: resolvedIdentity,
    initialized: true,
    hasResolvedOwner: Boolean(
      amountAtomOwnerState.hasResolvedOwner ||
      (amountOwnerKey && resolvedIdentity),
    ),
  } satisfies IStockAmountAtomOwnerState;
}

export function resolveStockAmountAtomInitialization({
  amountAtomOwnerState,
  amountOwnerKey,
  canonicalOwnerReady,
  restoredValue,
}: {
  amountAtomOwnerState: IStockAmountAtomOwnerState;
  amountOwnerKey: string;
  canonicalOwnerReady: boolean;
  restoredValue?: string;
}) {
  const shouldInitialize = Boolean(
    canonicalOwnerReady &&
    amountOwnerKey &&
    amountAtomOwnerState.ownerKey === amountOwnerKey &&
    !amountAtomOwnerState.initialized,
  );
  return {
    shouldInitialize,
    seedValue: shouldInitialize ? restoredValue : undefined,
  };
}

export function commitStockAmountInputSnapshot({
  amountAtomOwnerState,
  canonicalOwnerKey,
  commitSnapshot,
  expectedOwnerKey,
  value,
}: {
  amountAtomOwnerState: IStockAmountAtomOwnerState;
  canonicalOwnerKey: string;
  commitSnapshot: (params: {
    expectedOwnerKey: string;
    value: string;
  }) => boolean;
  expectedOwnerKey: string;
  value: string;
}) {
  if (
    !expectedOwnerKey ||
    canonicalOwnerKey !== expectedOwnerKey ||
    amountAtomOwnerState.ownerKey !== expectedOwnerKey
  ) {
    return false;
  }
  return commitSnapshot({ expectedOwnerKey, value });
}

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

export function resolveStockRenderedBalanceSnapshot({
  displayAccountKey,
  displayInputToken,
  matchingSnapshotBalance,
}: {
  displayAccountKey?: string;
  displayInputToken?: Partial<ISwapToken>;
  matchingSnapshotBalance?: ISwapStockDisplayBalanceSnapshot;
}) {
  // This fallback is presentation-only. Execution readiness below continues
  // to consume only the live owner-scoped balance request and published atom.
  const storedDisplayBalance = displayAccountKey
    ? swapStockDisplaySnapshotStorage.get(displayAccountKey)?.balance
    : undefined;
  return resolveStockSnapshotBalanceForDisplay({
    displayAccountKey,
    displayInputToken,
    snapshotBalance: matchingSnapshotBalance ?? storedDisplayBalance,
  });
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
          const account = await runStockExecutionBalanceRequest({
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
        const detail = await runStockExecutionBalanceRequest({
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
  const [, setToTokenAmount] = useSwapToTokenAmountAtom();
  const [, setSwapAlerts] = useSwapAlertsAtom();
  const [fromTokenBalance, setFromTokenBalance] =
    useSwapStockSelectedFromTokenBalanceAtom();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const { resetQuoteAction } = useSwapActions().current;
  const {
    currentStockToken,
    payToken,
    payTokenStatus,
    payTokens,
    selectablePayTokens,
    payTokenOptionsLoading,
    disableNativePayToken,
    selectPayToken,
    stockDisplay,
    stockTokenStatus,
    tradeSide,
  } = stockChannel;
  const commitStockDisplaySnapshotPatch = stockDisplay.commitSnapshotPatch;
  const commitStockDisplayAmountSnapshot = stockDisplay.amount.commitSnapshot;
  const stockDisplayIdentityKey = stockDisplay.identityKey;
  const isBuySide = tradeSide === ESwapStockTradeSide.Buy;
  const { displayInputToken, executionInputToken } =
    resolveStockAmountInputTokens({
      currentStockToken,
      payToken,
      selection: stockDisplay.selection.snapshot,
      tradeSide,
    });
  const displayInputTokenVisible = Boolean(displayInputToken);
  const executionInputTokenVisible = Boolean(executionInputToken);
  const inputTokenStatus = isBuySide ? payTokenStatus : stockTokenStatus;
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
    : stockIdentityReady && executionInputTokenVisible;
  const inputTokenKey = getStockInputTokenIdentityKey(executionInputToken);
  const canonicalInputOwnerReady = isStockCanonicalInputOwnerReady({
    displayIdentityKey: stockDisplayIdentityKey,
    inputTokenKey,
    inputTokenReady,
    inputTokenVisible: executionInputTokenVisible,
  });
  const amountOwnerKey = resolveStockAmountDisplayOwnerKey({
    amountIdentity: stockDisplay.amount.identity,
    amountOwnerKey: stockDisplay.amount.ownerKey,
    currentStockToken,
    payToken,
    tradeSide,
  });
  const restoredAmountValue = amountOwnerKey
    ? stockDisplay.amount.restoredValue
    : undefined;
  const [amountAtomOwnerState, setAmountAtomOwnerState] =
    useState<IStockAmountAtomOwnerState>({
      ownerKey: undefined,
      initialized: false,
      hasResolvedOwner: false,
    });
  const amountAtomOwnerStateRef = useRef(amountAtomOwnerState);
  amountAtomOwnerStateRef.current = amountAtomOwnerState;
  const setAmountAtomOwnerStateWithRef = useCallback(
    (nextState: IStockAmountAtomOwnerState) => {
      amountAtomOwnerStateRef.current = nextState;
      setAmountAtomOwnerState(nextState);
    },
    [],
  );
  const inputEditable = isStockAmountInputEditable({
    amountOwnerKey,
    canonicalOwnerReady: canonicalInputOwnerReady,
  });
  const canonicalAmountOwnerKey = inputEditable ? amountOwnerKey : '';
  const canonicalAmountOwnerKeyRef = useRef(canonicalAmountOwnerKey);
  canonicalAmountOwnerKeyRef.current = canonicalAmountOwnerKey;
  const nextAmountIdentity = amountOwnerKey
    ? stockDisplay.amount.identity
    : undefined;
  const pendingOwnerTransition = resolveStockAmountOwnerTransition({
    amountAtomOwnerState,
    atomValue: fromTokenAmount.value,
    nextIdentity: nextAmountIdentity,
    nextOwnerKey: amountOwnerKey,
    restoredValue: restoredAmountValue,
  });
  const inputValue = pendingOwnerTransition.ownerChanged
    ? pendingOwnerTransition.displayValue
    : resolveStockAmountInputValue({
        amountAtomOwnerState,
        amountOwnerKey,
        atomValue: fromTokenAmount.value,
        restoredValue: restoredAmountValue,
      });

  useLayoutEffect(() => {
    const transition = resolveStockAmountOwnerTransition({
      amountAtomOwnerState: amountAtomOwnerStateRef.current,
      atomValue: fromTokenAmount.value,
      nextIdentity: nextAmountIdentity,
      nextOwnerKey: amountOwnerKey,
      restoredValue: restoredAmountValue,
    });
    if (!transition.ownerChanged) {
      return;
    }
    setAmountAtomOwnerStateWithRef(transition.nextState);
    // Revoke dependent state before paint. Stock/pay-token transitions rebind
    // the current input; account and side changes stay fail-closed.
    void resetQuoteAction();
    setSwapAlerts({ quoteId: '', states: [] });
    setToTokenAmount({ value: '', isInput: false });
    setFromTokenAmount(buildStockAmountQuoteIntent(transition.atomValue));
    if (transition.shouldCommitSnapshot && amountOwnerKey) {
      commitStockDisplayAmountSnapshot({
        expectedOwnerKey: amountOwnerKey,
        value: transition.atomValue,
      });
    }
  }, [
    amountOwnerKey,
    commitStockDisplayAmountSnapshot,
    fromTokenAmount.value,
    nextAmountIdentity,
    resetQuoteAction,
    restoredAmountValue,
    setAmountAtomOwnerStateWithRef,
    setFromTokenAmount,
    setSwapAlerts,
    setToTokenAmount,
  ]);

  useEffect(() => {
    const initialization = resolveStockAmountAtomInitialization({
      amountAtomOwnerState: amountAtomOwnerStateRef.current,
      amountOwnerKey,
      canonicalOwnerReady:
        canonicalAmountOwnerKeyRef.current === amountOwnerKey,
      restoredValue: restoredAmountValue,
    });
    if (!initialization.shouldInitialize) {
      return;
    }
    setAmountAtomOwnerStateWithRef(
      markStockAmountOwnerInitialized({
        amountAtomOwnerState: amountAtomOwnerStateRef.current,
        amountIdentity: nextAmountIdentity,
        amountOwnerKey,
      }),
    );
    if (initialization.seedValue === undefined) {
      return;
    }
    // A restored value is display-only until the exact live owner is ready.
    // Publishing it as user intent here starts a fresh owner-scoped quote;
    // the snapshot itself never marks balance or execution as ready.
    setSwapAlerts({ quoteId: '', states: [] });
    setFromTokenAmount(buildStockAmountQuoteIntent(initialization.seedValue));
  }, [
    amountOwnerKey,
    canonicalAmountOwnerKey,
    nextAmountIdentity,
    restoredAmountValue,
    setAmountAtomOwnerStateWithRef,
    setFromTokenAmount,
    setSwapAlerts,
  ]);

  const stockInputTokenBalance = useStockInputTokenBalance({
    displayIdentityKey: stockDisplayIdentityKey,
    enabled: canonicalInputOwnerReady,
    token: executionInputToken,
  });
  const displayAccountKey =
    stockDisplay.selection.snapshot?.identity.accountKey;
  const snapshotBalance = resolveStockRenderedBalanceSnapshot({
    displayAccountKey,
    displayInputToken,
    matchingSnapshotBalance: stockDisplay.snapshot?.balance,
  });
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
    displayInputToken?.networkLogoURI ??
    getNetworkLogoURI(displayInputToken?.networkId);
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
      token: displayInputToken,
      fallbackCurrency: STOCK_PRICE_SOURCE_CURRENCY,
    });
  const amountFiatValue = useMemo(() => {
    return getStockTokenFiatValue({
      amount: inputValue,
      tokenPrice: inputTokenPrice,
      targetCurrency: settingsPersistAtom.currencyInfo.id,
      currencyMap,
    });
  }, [
    currencyMap,
    inputValue,
    inputTokenPrice,
    settingsPersistAtom.currencyInfo.id,
  ]);
  const currencySymbol =
    currencyMap[settingsPersistAtom.currencyInfo.id]?.unit ??
    currencyMap[STOCK_PRICE_SOURCE_CURRENCY]?.unit ??
    settingsPersistAtom.currencyInfo.symbol;
  const publishInputValue = useCallback(
    (value: string) => {
      const committed = commitStockAmountInputSnapshot({
        amountAtomOwnerState: amountAtomOwnerStateRef.current,
        canonicalOwnerKey: canonicalAmountOwnerKeyRef.current,
        commitSnapshot: commitStockDisplayAmountSnapshot,
        expectedOwnerKey: amountOwnerKey,
        value,
      });
      if (!committed) {
        return false;
      }
      setAmountAtomOwnerStateWithRef(
        markStockAmountOwnerInitialized({
          amountAtomOwnerState: amountAtomOwnerStateRef.current,
          amountIdentity: nextAmountIdentity,
          amountOwnerKey,
        }),
      );
      setSwapAlerts({ quoteId: '', states: [] });
      setFromTokenAmount(buildStockAmountQuoteIntent(value));
      return true;
    },
    [
      amountOwnerKey,
      commitStockDisplayAmountSnapshot,
      nextAmountIdentity,
      setAmountAtomOwnerStateWithRef,
      setFromTokenAmount,
      setSwapAlerts,
    ],
  );
  const onAmountChange = useCallback(
    (value: string) => {
      if (validateAmountInput(value, executionInputToken?.decimals)) {
        publishInputValue(value);
      }
    },
    [executionInputToken?.decimals, publishInputValue],
  );
  const setInputAmount = useCallback(
    (amount: BigNumber) => {
      if (!executionInputToken || !amount.isFinite() || amount.isNaN()) {
        return;
      }
      const amountValue = amount
        .decimalPlaces(
          Number(executionInputToken.decimals ?? 6),
          BigNumber.ROUND_DOWN,
        )
        .toFixed();
      if (!validateAmountInput(amountValue, executionInputToken.decimals)) {
        return;
      }
      publishInputValue(amountValue);
    },
    [executionInputToken, publishInputValue],
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
      !executionInputToken ||
      !balanceReadyForExecution ||
      stockInputTokenBalance.balance === undefined
    ) {
      return false;
    }
    const balanceBN = new BigNumber(stockInputTokenBalance.balance);
    const amountBN = new BigNumber(inputValue || '0');
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
    executionInputToken,
    inputValue,
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
  useLayoutEffect(() => {
    // Keep the Stock-only published balance scoped to the exact execution
    // owner so an old account/pair cannot unlock the new owner. Ordinary Swap
    // keeps its own cached balance behind the active-balance projection.
    setFromTokenBalance('');
  }, [canonicalBalanceScope, setFromTokenBalance]);
  useEffect(() => {
    if (
      !canonicalInputOwnerReady ||
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
    canonicalInputOwnerReady,
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
    balanceLoading:
      displayBalance === undefined && stockInputTokenBalance.loading,
    balanceReadyForExecution,
    currencySymbol,
    disableNativePayToken,
    displayBalance,
    hasBalanceError,
    inputEditable,
    inputToken: displayInputToken,
    inputTokenNetworkLogoURI,
    inputValue,
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
      inputTokenStatus,
      inputTokenVisible: displayInputTokenVisible,
    }),
  };
}
