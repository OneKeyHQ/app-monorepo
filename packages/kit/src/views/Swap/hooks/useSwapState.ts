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
  useSwapAlertsAtom,
  useSwapBuildTxFetchingAtom,
  useSwapFromTokenAmountAtom,
  useSwapLimitPriceUseRateAtom,
  useSwapProTradeTypeAtom,
  useSwapQuoteApproveAllowanceUnLimitAtom,
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
  useSwapSelectedFromTokenBalanceAtom,
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
  isSwapQuoteEventFetching,
  isSwapQuoteInputAmountMatched,
  isSwapZeroProviderQuoteCompleted,
  selectSwapPreviousActionableQuote,
} from '../../../states/jotai/contexts/swap/quoteProgress';
import { buildSwapBatchTransferType } from '../utils/buildSwapReviewState';
import { shouldAllowSwapNoConnectWalletWarning } from '../utils/swapNoWalletWarningGuard';
import { getStockQuoteTradeControl } from '../utils/swapStockTradeControl';

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
  const [fromTokenBalance] = useSwapSelectedFromTokenBalanceAtom();
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
        hasAccountWallet: Boolean(swapFromAddressInfo.accountInfo?.wallet),
        isWebDappMode: Boolean(platformEnv.isWebDappMode),
        walletListResolvedNoWallet: walletListResult?.wallets.length === 0,
      }),
    [
      accountSelectorActiveAccountInitDone,
      accountSelectorStorageInitDone,
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
      return Boolean(
        (quote.kind === ESwapQuoteKind.BUY
          ? toTokenAmount.value
          : fromTokenAmount.value) &&
        isSwapQuoteInputAmountMatched({
          quote,
          fromAmount: fromTokenAmount.value,
          toAmount: toTokenAmount.value,
        }),
      );
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
        quoteLoading,
        quoteEventFetching,
      }),
    [
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
  const { quoteLoading, quoteEventFetching, isWaitingActionableQuote } =
    useSwapQuoteProgressState();
  const [quoteCurrentSelect] = useSwapQuoteCurrentSelectAtom();
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
  const [selectedFromTokenBalance] = useSwapSelectedFromTokenBalanceAtom();
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
    return Boolean(
      quoteCurrentSelect &&
      inputAmount &&
      !isSwapQuoteInputAmountMatched({
        quote: quoteCurrentSelect,
        fromAmount: fromTokenAmount.value,
        toAmount: toTokenAmount.value,
      }),
    );
  }, [fromTokenAmount.value, quoteCurrentSelect, toTokenAmount.value]);
  const quoteResultNoMatch = useMemo(
    () =>
      (quoteCurrentSelect &&
        (quoteCurrentSelect.fromTokenInfo.networkId !== fromToken?.networkId ||
          quoteCurrentSelect.toTokenInfo.networkId !== toToken?.networkId ||
          quoteCurrentSelect.fromTokenInfo.contractAddress !==
            fromToken?.contractAddress ||
          quoteCurrentSelect.toTokenInfo.contractAddress !==
            toToken?.contractAddress)) ||
      quoteInputAmountNoMatch ||
      (quoteCurrentSelect?.protocol !== EProtocolOfExchange.LIMIT &&
        quoteCurrentSelect?.kind === ESwapQuoteKind.SELL &&
        quoteCurrentSelect?.allowanceResult &&
        quoteCurrentSelect.allowanceResult.amount !== fromTokenAmount.value),
    [
      fromToken?.contractAddress,
      fromToken?.networkId,
      fromTokenAmount,
      quoteCurrentSelect,
      quoteInputAmountNoMatch,
      toToken?.contractAddress,
      toToken?.networkId,
    ],
  );
  const quoteResultNoMatchDebounce = useDebounce(quoteResultNoMatch, 10);
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
  const actionInfo = useMemo(() => {
    const infoRes = {
      disable: !(!hasError && !!quoteCurrentSelect),
      noConnectWallet: alerts.states.some((item) => item.noConnectWallet),
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
    if (
      isWaitingActionableQuote ||
      isWaitingAutoSlippage ||
      swapApprovingMatchLoading ||
      buildTxFetching
    ) {
      infoRes.disable = true;
    } else {
      if (
        isZeroProviderQuoteCompleted ||
        (quoteCurrentSelect &&
          !quoteCurrentSelect.toAmount &&
          !quoteCurrentSelect.limit)
      ) {
        infoRes.label = intl.formatMessage({
          id: ETranslations.swap_page_alert_no_provider_supports_trade,
        });
        infoRes.disable = true;
      }
      const stockTradeControl =
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

      if (isRefreshQuote || quoteResultNoMatchDebounce) {
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
    intl,
    swapFromAddressInfo.address,
    swapToAddressInfo.address,
    fromTokenAmount.value,
    quoteInputAmountNoMatch,
    swapTypeSwitchValue,
    isRefreshQuote,
    toTokenAmount.value,
    isWaitingActionableQuote,
    isWaitingAutoSlippage,
    swapApprovingMatchLoading,
    buildTxFetching,
    selectedFromTokenBalance,
    fromToken,
    toToken,
    quoteResultNoMatchDebounce,
    swapUseLimitPrice.rate,
    isZeroProviderQuoteCompleted,
  ]);
  const stepState: ISwapState = {
    label: actionInfo.label,
    isLoading: buildTxFetching,
    approving: swapApprovingMatchLoading,
    noConnectWallet: actionInfo.noConnectWallet,
    disabled:
      actionInfo.disable ||
      isWaitingActionableQuote ||
      isWaitingAutoSlippage ||
      swapApprovingMatchLoading,
    approveUnLimit: swapQuoteApproveAllowanceUnLimit,
    isApprove: !!quoteCurrentSelect?.allowanceResult,
    isCrossChain,
    shoutResetApprove:
      !!quoteCurrentSelect?.allowanceResult?.shouldResetApprove,
    isWrapped: !!quoteCurrentSelect?.isWrapped,
    isRefreshQuote:
      (isRefreshQuote || quoteResultNoMatchDebounce) &&
      !quoteLoading &&
      !quoteEventFetching,
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
