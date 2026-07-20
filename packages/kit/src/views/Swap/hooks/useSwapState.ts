import { useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { debounce, isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  useInAppNotificationAtom,
  useSettingsAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { sortSwapQuotes } from '@onekeyhq/shared/src/utils/swapQuoteSortUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  ESwapProviderSort,
  swapQuoteIntervalMaxCount,
  swapSlippageAutoValue,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ISwapCheckWarningDef,
  ISwapState,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapAlertLevel,
  ESwapDirectionType,
  ESwapProTradeType,
  ESwapQuoteKind,
  ESwapSlippageSegmentKey,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useAccountSelectorStorageInitDoneAtom,
  useIsAccountSelectorActiveAccountInitDone,
} from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapActiveSelectedFromTokenBalanceAtom,
  useSwapAlertsAtom,
  useSwapBuildTxFetchingAtom,
  useSwapFromTokenAmountAtom,
  useSwapLimitPriceUseRateAtom,
  useSwapProTradeTypeAtom,
  useSwapQuoteActionLockAtom,
  useSwapQuoteApproveAllowanceUnLimitAtom,
  useSwapQuoteCurrentEventProviderKeysAtom,
  useSwapQuoteCurrentEventReceivedCountAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteEventCompletedAtom,
  useSwapQuoteEventErrorAtom,
  useSwapQuoteEventTotalCountAtom,
  useSwapQuoteFetchingAtom,
  useSwapQuoteIntervalCountAtom,
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapShouldRefreshQuoteAtom,
  useSwapSilenceQuoteLoading,
  useSwapSlippageOverrideAtom,
  useSwapSpeedQuoteResultAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import {
  SWAP_INCOGNITO_QUOTE_PROVIDER_COUNT_CAP,
  getSwapQuoteEventProgressTotalCount,
  getSwapQuoteProgressState,
  hasSwapQuoteEventTotalCount,
  isSwapNoProviderSupportsTrade,
  isSwapOrBridgeQuoteType,
  isSwapQuoteEventFetching,
  isSwapQuoteInputAmountMatched,
  isSwapQuoteRequestForCurrentInput,
  isSwapZeroProviderQuoteCompleted,
  selectSwapPreviousActionableQuote,
  shouldOfferSwapQuoteRefresh,
  shouldShowSwapQuoteActionLoading,
  shouldShowSwapQuoteRequestLoading,
} from '../../../states/jotai/contexts/swap/quoteProgress';
import { buildSwapBatchTransferType } from '../utils/buildSwapReviewState';
import { shouldAllowSwapNoConnectWalletWarning } from '../utils/swapNoWalletWarningGuard';
import {
  getStockQuoteTradeControl,
  isStockQuoteInputAmountMatched,
} from '../utils/swapStockTradeControl';

import { useSwapAddressInfo } from './useSwapAccount';

function useSwapWarningCheck() {
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [quoteCurrentSelect] = useSwapQuoteCurrentSelectAtom();
  const [quoteEventTotalCount] = useSwapQuoteEventTotalCountAtom();
  const [quoteEventCompleted] = useSwapQuoteEventCompletedAtom();
  const [quoteEventError] = useSwapQuoteEventErrorAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [fromTokenBalance] = useSwapActiveSelectedFromTokenBalanceAtom();
  const { checkSwapWarning } = useSwapActions().current;
  const [swapLimitUseRate] = useSwapLimitPriceUseRateAtom();
  const [accountSelectorStorageInitDone] =
    useAccountSelectorStorageInitDoneAtom();
  const accountSelectorActiveAccountInitDone =
    useIsAccountSelectorActiveAccountInitDone(0);
  const { result: walletListResult } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceAccount.getWallets({
        ignoreEmptySingletonWalletAccounts: true,
      }),
    [],
    {
      checkIsFocused: false,
      watchLoading: false,
    },
  );
  const allowNoConnectWallet = useMemo(
    () =>
      shouldAllowSwapNoConnectWalletWarning({
        accountInfoReady: swapFromAddressInfo.accountInfo?.ready,
        accountSelectorActiveAccountInitDone,
        accountSelectorStorageInitDone,
        hasAccount: Boolean(swapFromAddressInfo.accountInfo?.account),
        hasAccountWallet: Boolean(swapFromAddressInfo.accountInfo?.wallet),
        isWebDappMode: Boolean(platformEnv.isWebDappMode),
        walletListResolvedNoWallet: walletListResult?.wallets.length === 0,
      }),
    [
      accountSelectorActiveAccountInitDone,
      accountSelectorStorageInitDone,
      swapFromAddressInfo.accountInfo?.account,
      swapFromAddressInfo.accountInfo?.ready,
      swapFromAddressInfo.accountInfo?.wallet,
      walletListResult?.wallets.length,
    ],
  );
  const refContainer = useRef<ISwapCheckWarningDef>({
    swapFromAddressInfo: {
      address: undefined,
      networkId: undefined,
      accountInfo: undefined,
      activeAccount: undefined,
      isAddressInfoReady: false,
    },
    swapToAddressInfo: {
      address: undefined,
      networkId: undefined,
      accountInfo: undefined,
      activeAccount: undefined,
      isAddressInfoReady: false,
    },
  });
  const isFocused = useIsFocused();
  const asyncRefContainer = useCallback(() => {
    if (refContainer.current.swapFromAddressInfo !== swapFromAddressInfo) {
      refContainer.current.swapFromAddressInfo = swapFromAddressInfo;
    }
    if (refContainer.current.swapToAddressInfo !== swapToAddressInfo) {
      refContainer.current.swapToAddressInfo = swapToAddressInfo;
    }
  }, [swapFromAddressInfo, swapToAddressInfo]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checkSwapWarningDeb = useCallback(
    debounce((fromAddressInfo, toAddressInfo, allowNoConnect: boolean) => {
      void checkSwapWarning(fromAddressInfo, toAddressInfo, {
        allowNoConnectWallet: allowNoConnect,
      });
    }, 300),
    [],
  );

  useEffect(() => {
    if (isFocused) {
      asyncRefContainer();
      checkSwapWarningDeb(
        refContainer.current.swapFromAddressInfo,
        refContainer.current.swapToAddressInfo,
        allowNoConnectWallet,
      );
    }
  }, [
    allowNoConnectWallet,
    asyncRefContainer,
    checkSwapWarningDeb,
    fromToken,
    fromTokenAmount,
    toToken,
    fromTokenBalance,
    quoteCurrentSelect,
    quoteEventCompleted,
    quoteEventError,
    quoteEventTotalCount,
    isFocused,
    swapLimitUseRate,
  ]);
}

export function useSwapQuoteLoading() {
  const [quoteFetching] = useSwapQuoteFetchingAtom();
  const [silenceQuoteLoading] = useSwapSilenceQuoteLoading();
  return quoteFetching || silenceQuoteLoading;
}

export function useSwapQuoteEventFetching() {
  const [quoteEventTotalCount] = useSwapQuoteEventTotalCountAtom();
  const [quoteEventCompleted] = useSwapQuoteEventCompletedAtom();
  const [currentEventReceivedCount] =
    useSwapQuoteCurrentEventReceivedCountAtom();
  const [{ swapIncognitoMode }] = useSettingsAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const quoteEventProgressTotalCount = useMemo(
    () =>
      getSwapQuoteEventProgressTotalCount({
        quoteEventTotalCount,
        maxQuoteCount:
          swapIncognitoMode &&
          swapTypeSwitch !== ESwapTabSwitchType.LIMIT &&
          swapTypeSwitch !== ESwapTabSwitchType.STOCK
            ? SWAP_INCOGNITO_QUOTE_PROVIDER_COUNT_CAP
            : undefined,
      }),
    [quoteEventTotalCount, swapIncognitoMode, swapTypeSwitch],
  );

  return isSwapQuoteEventFetching({
    quoteEventTotalCount: quoteEventProgressTotalCount,
    currentEventReceivedCount,
    quoteEventCompleted,
  });
}

export function useSwapQuoteProgressState() {
  const quoteLoading = useSwapQuoteLoading();
  const quoteEventFetching = useSwapQuoteEventFetching();
  const [quoteCurrentSelect] = useSwapQuoteCurrentSelectAtom();
  const [quoteList] = useSwapQuoteListAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [toTokenAmount] = useSwapToTokenAmountAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const [quoteEventTotalCount] = useSwapQuoteEventTotalCountAtom();
  const [quoteEventCompleted] = useSwapQuoteEventCompletedAtom();
  const [quoteEventError] = useSwapQuoteEventErrorAtom();
  const [currentEventProviderKeys] = useSwapQuoteCurrentEventProviderKeysAtom();

  const scopedPreviousQuoteList = useMemo(() => {
    const list = quoteList.filter((quote) => {
      if (!fromToken || !toToken) {
        return false;
      }
      if (
        !equalTokenNoCaseSensitive({
          token1: quote.fromTokenInfo,
          token2: fromToken,
        }) ||
        !equalTokenNoCaseSensitive({
          token1: quote.toTokenInfo,
          token2: toToken,
        })
      ) {
        return false;
      }
      if (
        swapTypeSwitch === ESwapTabSwitchType.STOCK &&
        quote.protocol !== EProtocolOfExchange.STOCK
      ) {
        return false;
      }
      if (
        swapTypeSwitch === ESwapTabSwitchType.LIMIT &&
        quote.protocol !== EProtocolOfExchange.LIMIT
      ) {
        return false;
      }
      if (
        swapTypeSwitch !== ESwapTabSwitchType.STOCK &&
        swapTypeSwitch !== ESwapTabSwitchType.LIMIT &&
        (quote.protocol === EProtocolOfExchange.STOCK ||
          quote.protocol === EProtocolOfExchange.LIMIT)
      ) {
        return false;
      }
      const inputAmountMatched =
        swapTypeSwitch === ESwapTabSwitchType.STOCK
          ? isStockQuoteInputAmountMatched({
              quote,
              fromAmount: fromTokenAmount.value,
              toAmount: toTokenAmount.value,
            })
          : isSwapQuoteInputAmountMatched({
              quote,
              fromAmount: fromTokenAmount.value,
              toAmount: toTokenAmount.value,
            });
      const inputAmount =
        quote.kind === ESwapQuoteKind.BUY
          ? toTokenAmount.value
          : fromTokenAmount.value;
      return Boolean(inputAmount && inputAmountMatched);
    });
    return sortSwapQuotes(list, {
      sort: ESwapProviderSort.RECOMMENDED,
      fromTokenAmount: fromTokenAmount.value,
    });
  }, [
    fromToken,
    fromTokenAmount.value,
    quoteList,
    swapTypeSwitch,
    toToken,
    toTokenAmount.value,
  ]);

  const previousQuote = useMemo(
    () =>
      selectSwapPreviousActionableQuote({
        quotes: scopedPreviousQuoteList,
        quoteEventTotalCount,
        currentEventProviderKeys,
        quoteLoading,
        quoteEventFetching,
      }),
    [
      currentEventProviderKeys,
      quoteEventFetching,
      quoteEventTotalCount,
      quoteLoading,
      scopedPreviousQuoteList,
    ],
  );

  return useMemo(
    () =>
      getSwapQuoteProgressState({
        quoteLoading,
        quoteEventFetching,
        quoteCurrentSelect,
        previousQuote,
        quoteEventTotalCount,
        quoteEventCompleted,
        quoteEventError,
      }),
    [
      quoteCurrentSelect,
      quoteEventCompleted,
      quoteEventError,
      quoteEventFetching,
      quoteEventTotalCount,
      quoteLoading,
      previousQuote,
    ],
  );
}

export function useSwapZeroProviderQuoteCompleted() {
  const [quoteEventTotalCount] = useSwapQuoteEventTotalCountAtom();
  const [quoteEventCompleted] = useSwapQuoteEventCompletedAtom();

  return useMemo(
    () =>
      isSwapZeroProviderQuoteCompleted({
        quoteEventTotalCount,
        quoteEventCompleted,
      }),
    [quoteEventCompleted, quoteEventTotalCount],
  );
}

export function useSwapBatchTransferType(
  networkId?: string,
  accountId?: string,
  providerDisableBatchTransfer?: boolean,
  swapShouldSignedData?: boolean,
  needApprove?: boolean,
) {
  const [settingsPersistAtom] = useSettingsPersistAtom();

  return buildSwapBatchTransferType({
    networkId,
    accountId,
    providerDisableBatchTransfer,
    swapShouldSignedData,
    needApprove,
    batchApproveAndSwapEnabled: settingsPersistAtom.swapBatchApproveAndSwap,
  });
}

export function useSwapActionState() {
  const intl = useIntl();
  const {
    hasActionableQuote,
    quoteLoading,
    quoteEventFetching,
    isWaitingActionableQuote,
  } = useSwapQuoteProgressState();
  const [quoteCurrentSelect] = useSwapQuoteCurrentSelectAtom();
  const [quoteActionLock] = useSwapQuoteActionLockAtom();
  const [buildTxFetching] = useSwapBuildTxFetchingAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [toTokenAmount] = useSwapToTokenAmountAtom();
  const [shouldRefreshQuote] = useSwapShouldRefreshQuoteAtom();
  const [{ swapSlippagePercentageMode }] = useSettingsAtom();
  const [quoteEventTotalCount] = useSwapQuoteEventTotalCountAtom();
  const [quoteEventCompleted] = useSwapQuoteEventCompletedAtom();
  const [swapQuoteApproveAllowanceUnLimit] =
    useSwapQuoteApproveAllowanceUnLimitAtom();
  useSwapWarningCheck();
  const [alerts] = useSwapAlertsAtom();
  const [selectedFromTokenBalance] =
    useSwapActiveSelectedFromTokenBalanceAtom();
  const isCrossChain = fromToken?.networkId !== toToken?.networkId;
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const [quoteIntervalCount] = useSwapQuoteIntervalCountAtom();
  const [swapUseLimitPrice] = useSwapLimitPriceUseRateAtom();
  const [swapTypeSwitchValue] = useSwapTypeSwitchAtom();
  const [{ swapApprovingLoading, swapApprovingTransaction }] =
    useInAppNotificationAtom();
  const isZeroProviderQuoteCompleted = useSwapZeroProviderQuoteCompleted();

  const swapApprovingMatchLoading = useMemo(() => {
    return (
      swapApprovingLoading &&
      (fromTokenAmount.value === swapApprovingTransaction?.amount ||
        fromTokenAmount.value ===
          swapApprovingTransaction?.resetApproveValue) &&
      equalTokenNoCaseSensitive({
        token1: swapApprovingTransaction?.fromToken,
        token2: fromToken,
      }) &&
      equalTokenNoCaseSensitive({
        token1: swapApprovingTransaction?.toToken,
        token2: toToken,
      })
    );
  }, [
    swapApprovingLoading,
    fromTokenAmount.value,
    swapApprovingTransaction?.amount,
    swapApprovingTransaction?.resetApproveValue,
    swapApprovingTransaction?.fromToken,
    swapApprovingTransaction?.toToken,
    fromToken,
    toToken,
  ]);

  const isRefreshQuote = useMemo(
    () => quoteIntervalCount > swapQuoteIntervalMaxCount || shouldRefreshQuote,
    [quoteIntervalCount, shouldRefreshQuote],
  );

  const hasError = alerts.states.some(
    (item) => item.alertLevel === ESwapAlertLevel.ERROR,
  );
  const quoteInputAmountNoMatch = useMemo(() => {
    const inputAmount =
      quoteCurrentSelect?.kind === ESwapQuoteKind.BUY
        ? toTokenAmount.value
        : fromTokenAmount.value;
    const inputAmountMatched =
      swapTypeSwitchValue === ESwapTabSwitchType.STOCK
        ? isStockQuoteInputAmountMatched({
            quote: quoteCurrentSelect,
            fromAmount: fromTokenAmount.value,
            toAmount: toTokenAmount.value,
          })
        : isSwapQuoteInputAmountMatched({
            quote: quoteCurrentSelect,
            fromAmount: fromTokenAmount.value,
            toAmount: toTokenAmount.value,
          });
    return Boolean(quoteCurrentSelect && inputAmount && !inputAmountMatched);
  }, [
    fromTokenAmount.value,
    quoteCurrentSelect,
    swapTypeSwitchValue,
    toTokenAmount.value,
  ]);
  // Pair identity must match the quote ingestion path, which accepts quotes
  // via equalTokenNoCaseSensitive (e.g. checksum vs lowercase EVM contract
  // addresses); a raw !== compare would flag those quotes as a stale pair.
  const quoteResultPairNoMatch = useMemo(
    () =>
      Boolean(
        quoteCurrentSelect &&
        !(
          equalTokenNoCaseSensitive({
            token1: quoteCurrentSelect.fromTokenInfo,
            token2: fromToken,
          }) &&
          equalTokenNoCaseSensitive({
            token1: quoteCurrentSelect.toTokenInfo,
            token2: toToken,
          })
        ),
      ),
    [fromToken, quoteCurrentSelect, toToken],
  );
  const quoteResultNoMatch = useMemo(
    () =>
      Boolean(
        quoteResultPairNoMatch ||
        quoteInputAmountNoMatch ||
        (quoteCurrentSelect?.protocol !== EProtocolOfExchange.LIMIT &&
          quoteCurrentSelect?.kind === ESwapQuoteKind.SELL &&
          quoteCurrentSelect?.allowanceResult &&
          quoteCurrentSelect.allowanceResult.amount !== fromTokenAmount.value),
      ),
    [
      fromTokenAmount,
      quoteCurrentSelect,
      quoteInputAmountNoMatch,
      quoteResultPairNoMatch,
    ],
  );
  const quoteResultNoMatchDebounce = useDebounce(quoteResultNoMatch, 10);
  const canRefreshQuoteFromAction = shouldOfferSwapQuoteRefresh({
    isRefreshQuote,
    quoteResultNoMatch,
    quoteResultNoMatchDebounced: quoteResultNoMatchDebounce,
    quoteLoading,
    quoteEventFetching,
  });
  const isSwapOrBridgeQuote = isSwapOrBridgeQuoteType(swapTypeSwitchValue);
  const isQuoteEventSettlingForAction =
    isSwapOrBridgeQuote &&
    !quoteEventCompleted &&
    (quoteLoading ||
      quoteEventFetching ||
      Boolean(quoteCurrentSelect) ||
      hasSwapQuoteEventTotalCount({
        quoteEventTotalCount,
        quoteEventCompleted,
      }));
  const isWaitingAutoSlippage = useMemo(
    () =>
      swapSlippagePercentageMode === ESwapSlippageSegmentKey.AUTO &&
      quoteEventTotalCount.count > 0 &&
      !quoteEventCompleted &&
      quoteCurrentSelect?.protocol === EProtocolOfExchange.SWAP &&
      !quoteCurrentSelect.unSupportSlippage &&
      isNil(quoteCurrentSelect.autoSuggestedSlippage),
    [
      quoteCurrentSelect?.autoSuggestedSlippage,
      quoteCurrentSelect?.protocol,
      quoteCurrentSelect?.unSupportSlippage,
      quoteEventCompleted,
      quoteEventTotalCount.count,
      swapSlippagePercentageMode,
    ],
  );
  const isQuoteReadinessLoading = shouldShowSwapQuoteActionLoading({
    hasActionableQuote,
    isWaitingActionableQuote,
    isQuoteEventSettlingForAction,
    isWaitingAutoSlippage,
  });
  // "The CURRENT pair's quote round completed and no provider supports it."
  // The veto must be pair-identity based only: provider-error quotes carry
  // no amount fields, so the amount-aware quoteResultNoMatch would
  // permanently veto the genuine no-provider verdict. (OK-57545)
  const noProviderSupportsTrade = useMemo(
    () =>
      isSwapNoProviderSupportsTrade({
        zeroProviderQuoteCompleted: isZeroProviderQuoteCompleted,
        quote: quoteCurrentSelect,
        quoteResultPairNoMatch,
      }),
    [isZeroProviderQuoteCompleted, quoteCurrentSelect, quoteResultPairNoMatch],
  );
  const noConnectWallet = alerts.states.some((item) => item.noConnectWallet);
  const quoteRequestMatchesCurrentInput = useMemo(
    () =>
      isSwapQuoteRequestForCurrentInput({
        currentAccountId: swapFromAddressInfo.accountInfo?.account?.id,
        currentAddress: swapFromAddressInfo.address,
        currentReceivingAddress: swapToAddressInfo.address,
        currentSwapType: swapTypeSwitchValue,
        fromAmount: fromTokenAmount.value,
        fromToken,
        quoteKind: ESwapQuoteKind.SELL,
        quoteRequest: quoteActionLock,
        toAmount: toTokenAmount.value,
        toToken,
      }),
    [
      fromToken,
      fromTokenAmount.value,
      quoteActionLock,
      swapFromAddressInfo.accountInfo?.account?.id,
      swapFromAddressInfo.address,
      swapTypeSwitchValue,
      swapToAddressInfo.address,
      toToken,
      toTokenAmount.value,
    ],
  );
  const hasValidQuoteInput = useMemo(() => {
    const amount = new BigNumber(fromTokenAmount.value);
    return Boolean(
      fromTokenAmount.isInput &&
      fromToken &&
      toToken &&
      amount.isFinite() &&
      amount.gt(0),
    );
  }, [fromToken, fromTokenAmount, toToken]);
  const isQuoteRequestStarting = Boolean(
    quoteRequestMatchesCurrentInput &&
    quoteActionLock.actionLock &&
    !quoteEventTotalCount.eventId,
  );
  const isQuoteRequestLoading = Boolean(
    shouldShowSwapQuoteRequestLoading({
      swapType: swapTypeSwitchValue,
      hasCurrentActionableQuote: hasActionableQuote && !quoteResultNoMatch,
      hasValidInput: hasValidQuoteInput,
      isQuoteRequestStarting,
      quoteEventCompleted,
      quoteRequestMatchesInput: quoteRequestMatchesCurrentInput,
    }) ||
    (isSwapOrBridgeQuote &&
      hasValidQuoteInput &&
      quoteResultNoMatch &&
      !quoteResultNoMatchDebounce),
  );
  const isQuoteActionLoading = Boolean(
    !noConnectWallet &&
    !hasError &&
    !noProviderSupportsTrade &&
    (isQuoteReadinessLoading || isQuoteRequestLoading),
  );
  const shouldOfferQuoteRefreshAction =
    canRefreshQuoteFromAction &&
    !isQuoteActionLoading &&
    !noProviderSupportsTrade;
  const actionInfo = useMemo(() => {
    const infoRes = {
      disable: !(!hasError && !!quoteCurrentSelect),
      noConnectWallet,
      label: intl.formatMessage({ id: ETranslations.global_review }),
    };
    if (
      !swapFromAddressInfo.address ||
      !swapToAddressInfo.address ||
      quoteInputAmountNoMatch
    ) {
      infoRes.disable = true;
    }
    if (
      quoteCurrentSelect?.protocol === EProtocolOfExchange.LIMIT &&
      swapTypeSwitchValue !== ESwapTabSwitchType.LIMIT &&
      !isRefreshQuote
    ) {
      infoRes.disable = true;
    }
    if (
      quoteCurrentSelect?.protocol === EProtocolOfExchange.SWAP &&
      swapTypeSwitchValue !== ESwapTabSwitchType.SWAP &&
      swapTypeSwitchValue !== ESwapTabSwitchType.BRIDGE &&
      !isRefreshQuote
    ) {
      infoRes.disable = true;
    }
    if (
      quoteCurrentSelect?.protocol === EProtocolOfExchange.STOCK &&
      swapTypeSwitchValue !== ESwapTabSwitchType.STOCK &&
      !isRefreshQuote
    ) {
      infoRes.disable = true;
    }
    if (
      new BigNumber(toTokenAmount.value ?? 0).isZero() ||
      new BigNumber(toTokenAmount.value ?? 0).isNaN()
    ) {
      infoRes.disable = true;
    }
    if (isQuoteActionLoading || swapApprovingMatchLoading || buildTxFetching) {
      infoRes.disable = true;
    } else {
      if (noProviderSupportsTrade) {
        infoRes.label = intl.formatMessage({
          id: ETranslations.swap_page_alert_no_provider_supports_trade,
        });
        infoRes.disable = true;
      }
      const stockTradeControl =
        !quoteInputAmountNoMatch &&
        quoteCurrentSelect?.protocol === EProtocolOfExchange.STOCK
          ? getStockQuoteTradeControl({
              quoteResult: quoteCurrentSelect,
              fromTokenAmount: fromTokenAmount.value,
              fromTokenSymbol: fromToken?.symbol,
              intl,
            })
          : undefined;
      if (stockTradeControl) {
        infoRes.label = stockTradeControl.message;
        infoRes.disable = true;
      }
      if (
        quoteCurrentSelect?.protocol === EProtocolOfExchange.LIMIT &&
        !quoteCurrentSelect.isWrapped &&
        !quoteCurrentSelect.allowanceResult
      ) {
        if (
          !swapUseLimitPrice.rate ||
          new BigNumber(swapUseLimitPrice.rate ?? 0).isZero() ||
          new BigNumber(swapUseLimitPrice.rate ?? 0).isNaN()
        ) {
          infoRes.disable = true;
          infoRes.label = intl.formatMessage({
            id: ETranslations.limit_enter_price,
          });
        }
      }
      if (
        quoteCurrentSelect &&
        quoteCurrentSelect.toAmount &&
        !swapToAddressInfo.address
      ) {
        infoRes.label = intl.formatMessage({
          id: ETranslations.swap_page_button_enter_a_recipient,
        });
        infoRes.disable = true;
      }

      const balanceBN = new BigNumber(selectedFromTokenBalance ?? 0);
      const fromTokenAmountBN = new BigNumber(fromTokenAmount.value);
      if (
        fromToken &&
        swapFromAddressInfo.address &&
        balanceBN.lt(fromTokenAmountBN)
      ) {
        infoRes.label = networkUtils.isBTCNetwork(fromToken.networkId)
          ? intl.formatMessage({
              id: ETranslations.send_toast_btc_fork_insufficient_fund,
            })
          : intl.formatMessage(
              {
                id: ETranslations.swap_page_toast_insufficient_balance_title,
              },
              { token: fromToken.symbol },
            );
        infoRes.disable = true;
      }

      if (!fromToken || !toToken) {
        infoRes.label = intl.formatMessage({
          id: ETranslations.swap_page_button_select_token,
        });
        infoRes.disable = true;
      }
      if (fromTokenAmountBN.isNaN() || fromTokenAmountBN.isZero()) {
        infoRes.label = intl.formatMessage({
          id: ETranslations.swap_page_button_enter_amount,
        });
        infoRes.disable = true;
      }

      // Keep the disabled "no provider supports trade" state instead of
      // flipping to an actionable "Refresh quotes" button when no provider
      // supports the current pair. stepState.isRefreshQuote excludes this
      // state too, which keeps the rate-line refresh (auto interval + manual
      // tap) alive as the recovery path. (OK-57545)
      if (shouldOfferQuoteRefreshAction) {
        infoRes.label = intl.formatMessage({
          id: ETranslations.swap_page_button_refresh_quotes,
        });
        infoRes.disable = false;
      }
      if (alerts.states.some((item) => item.noConnectWallet)) {
        infoRes.label = intl.formatMessage({
          id: ETranslations.global_connect_wallet,
        });
        infoRes.disable = false;
      }
    }
    return infoRes;
  }, [
    hasError,
    quoteCurrentSelect,
    alerts.states,
    noConnectWallet,
    intl,
    swapFromAddressInfo.address,
    swapToAddressInfo.address,
    fromTokenAmount.value,
    quoteInputAmountNoMatch,
    swapTypeSwitchValue,
    isRefreshQuote,
    toTokenAmount.value,
    isQuoteActionLoading,
    shouldOfferQuoteRefreshAction,
    swapApprovingMatchLoading,
    buildTxFetching,
    selectedFromTokenBalance,
    fromToken,
    toToken,
    swapUseLimitPrice.rate,
    noProviderSupportsTrade,
  ]);
  const stepState: ISwapState = {
    label: actionInfo.label,
    isLoading: buildTxFetching,
    isQuoteActionLoading,
    approving: swapApprovingMatchLoading,
    noConnectWallet: actionInfo.noConnectWallet,
    disabled:
      actionInfo.disable || isQuoteActionLoading || swapApprovingMatchLoading,
    approveUnLimit: swapQuoteApproveAllowanceUnLimit,
    isApprove: !!quoteCurrentSelect?.allowanceResult,
    isCrossChain,
    shoutResetApprove:
      !!quoteCurrentSelect?.allowanceResult?.shouldResetApprove,
    isWrapped: !!quoteCurrentSelect?.isWrapped,
    // Excluded for noProviderSupportsTrade so SwapRefreshButton keeps its
    // auto interval and manual tap alive while the action button stays
    // disabled with "no provider supports trade". (OK-57545)
    isRefreshQuote: shouldOfferQuoteRefreshAction,
    isWaitingAutoSlippage,
  };
  return stepState;
}

export function useSwapSlippagePercentageModeInfo() {
  const [{ swapSlippagePercentageCustomValue, swapSlippagePercentageMode }] =
    useSettingsAtom();
  const [swapSlippageOverride] = useSwapSlippageOverrideAtom();
  const [swapCurrentQuote] = useSwapQuoteCurrentSelectAtom();
  const [swapProQuoteResult] = useSwapSpeedQuoteResultAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const focusSwapPro = useMemo(() => {
    return platformEnv.isNative && swapTypeSwitch === ESwapTabSwitchType.LIMIT;
  }, [swapTypeSwitch]);
  const quoteResult = useMemo(() => {
    if (focusSwapPro && swapProTradeType === ESwapProTradeType.MARKET) {
      return swapProQuoteResult;
    }
    return swapCurrentQuote;
  }, [focusSwapPro, swapProTradeType, swapCurrentQuote, swapProQuoteResult]);
  const res = useMemo(() => {
    let autoValue = swapSlippageAutoValue;
    let value = swapSlippageAutoValue;
    if (!isNil(quoteResult?.autoSuggestedSlippage)) {
      autoValue = quoteResult.autoSuggestedSlippage;
    }
    // Session-scoped override (e.g. Market preset) takes precedence over the
    // global persisted swap slippage so a user jumping in from Market with a
    // configured P1/P2/P3 slippage gets quote/build aligned to that value.
    const effectiveMode =
      swapSlippageOverride?.key ?? swapSlippagePercentageMode;
    const effectiveCustomValue =
      swapSlippageOverride?.key === ESwapSlippageSegmentKey.CUSTOM
        ? (swapSlippageOverride.value ?? swapSlippagePercentageCustomValue)
        : swapSlippagePercentageCustomValue;

    if (effectiveMode === ESwapSlippageSegmentKey.AUTO) {
      value = autoValue;
    } else {
      value = effectiveCustomValue;
    }
    return {
      slippageItem: {
        key: effectiveMode,
        value,
      },
      autoValue,
    };
  }, [
    quoteResult?.autoSuggestedSlippage,
    swapSlippageOverride,
    swapSlippagePercentageCustomValue,
    swapSlippagePercentageMode,
  ]);
  return res;
}
