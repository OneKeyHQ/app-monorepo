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
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
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
  ESwapQuoteKind,
  ESwapSlippageSegmentKey,
  ESwapTabSwitchType,
  SwapBuildUseMultiplePopoversNetworkIds,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useDebounce } from '../../../hooks/useDebounce';
import {
  useSwapActions,
  useSwapAlertsAtom,
  useSwapBuildTxFetchingAtom,
  useSwapFromTokenAmountAtom,
  useSwapLimitPriceUseRateAtom,
  useSwapQuoteApproveAllowanceUnLimitAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteEventTotalCountAtom,
  useSwapQuoteFetchingAtom,
  useSwapQuoteIntervalCountAtom,
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedFromTokenBalanceAtom,
  useSwapShouldRefreshQuoteAtom,
  useSwapSilenceQuoteLoading,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapAddressInfo } from './useSwapAccount';

function useSwapWarningCheck() {
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [quoteCurrentSelect] = useSwapQuoteCurrentSelectAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [fromTokenBalance] = useSwapSelectedFromTokenBalanceAtom();
  const { checkSwapWarning } = useSwapActions().current;
  const [swapLimitUseRate] = useSwapLimitPriceUseRateAtom();
  const refContainer = useRef<ISwapCheckWarningDef>({
    swapFromAddressInfo: {
      address: undefined,
      networkId: undefined,
      accountInfo: undefined,
      activeAccount: undefined,
    },
    swapToAddressInfo: {
      address: undefined,
      networkId: undefined,
      accountInfo: undefined,
      activeAccount: undefined,
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
    debounce((fromAddressInfo, toAddressInfo) => {
      void checkSwapWarning(fromAddressInfo, toAddressInfo);
    }, 300),
    [],
  );

  useEffect(() => {
    if (isFocused) {
      asyncRefContainer();
      checkSwapWarningDeb(
        refContainer.current.swapFromAddressInfo,
        refContainer.current.swapToAddressInfo,
      );
    }
  }, [
    asyncRefContainer,
    checkSwapWarningDeb,
    fromToken,
    fromTokenAmount,
    toToken,
    fromTokenBalance,
    quoteCurrentSelect,
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
  const [quoteResult] = useSwapQuoteListAtom();

  if (quoteEventTotalCount.count > 0) {
    if (
      quoteResult?.every((q) => q.eventId === quoteEventTotalCount.eventId) &&
      quoteResult.length === quoteEventTotalCount.count
    ) {
      return false;
    }
    return true;
  }
  return false;
}

export enum ESwapBatchTransferType {
  CONTINUOUS_APPROVE_AND_SWAP = 'continuous_approve_and_swap',
  BATCH_APPROVE_AND_SWAP = 'batch_approve_and_swap',
  NORMAL = 'normal',
}

export function useSwapBatchTransferType(
  networkId?: string,
  accountId?: string,
  providerDisableBatchTransfer?: boolean,
  swapShouldSignedData?: boolean,
  needApprove?: boolean,
) {
  let type = ESwapBatchTransferType.NORMAL;
  const [settingsPersistAtom] = useSettingsPersistAtom();
  if (settingsPersistAtom.swapBatchApproveAndSwap && needApprove) {
    type = ESwapBatchTransferType.BATCH_APPROVE_AND_SWAP;
  }
  const isExternalAccount = accountUtils.isExternalAccount({
    accountId: accountId ?? '',
  });
  const isHDAccount = accountUtils.isHwOrQrAccount({
    accountId: accountId ?? '',
  });
  if ((isExternalAccount || isHDAccount) && needApprove) {
    type = ESwapBatchTransferType.CONTINUOUS_APPROVE_AND_SWAP;
  }
  const isUnSupportBatchTransferNet =
    SwapBuildUseMultiplePopoversNetworkIds.includes(networkId ?? '');
  if (
    providerDisableBatchTransfer ||
    isUnSupportBatchTransferNet ||
    !settingsPersistAtom.swapBatchApproveAndSwap ||
    swapShouldSignedData
  ) {
    type = ESwapBatchTransferType.NORMAL;
  }
  return type;
}

export function useSwapActionState() {
  const intl = useIntl();
  const quoteLoading = useSwapQuoteLoading();
  const quoteEventFetching = useSwapQuoteEventFetching();
  const [quoteCurrentSelect] = useSwapQuoteCurrentSelectAtom();
  const [buildTxFetching] = useSwapBuildTxFetchingAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [toTokenAmount] = useSwapToTokenAmountAtom();
  const [shouldRefreshQuote] = useSwapShouldRefreshQuoteAtom();
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
  const quoteResultNoMatch = useMemo(
    () =>
      (quoteCurrentSelect &&
        (quoteCurrentSelect.fromTokenInfo.networkId !== fromToken?.networkId ||
          quoteCurrentSelect.toTokenInfo.networkId !== toToken?.networkId ||
          quoteCurrentSelect.fromTokenInfo.contractAddress !==
            fromToken?.contractAddress ||
          quoteCurrentSelect.toTokenInfo.contractAddress !==
            toToken?.contractAddress)) ||
      (quoteCurrentSelect?.protocol !== EProtocolOfExchange.LIMIT &&
        quoteCurrentSelect?.kind === ESwapQuoteKind.SELL &&
        quoteCurrentSelect?.allowanceResult &&
        quoteCurrentSelect.allowanceResult.amount !== fromTokenAmount.value),
    [
      fromToken?.contractAddress,
      fromToken?.networkId,
      fromTokenAmount,
      quoteCurrentSelect,
      toToken?.contractAddress,
      toToken?.networkId,
    ],
  );
  const quoteResultNoMatchDebounce = useDebounce(quoteResultNoMatch, 10);
  const actionInfo = useMemo(() => {
    const infoRes = {
      disable: !(!hasError && !!quoteCurrentSelect),
      noConnectWallet: alerts.states.some((item) => item.noConnectWallet),
      label: intl.formatMessage({ id: ETranslations.global_review }),
    };
    if (
      !swapFromAddressInfo.address ||
      !swapToAddressInfo.address ||
      (quoteCurrentSelect?.kind === ESwapQuoteKind.SELL &&
        quoteCurrentSelect?.fromAmount !== fromTokenAmount.value)
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
      new BigNumber(toTokenAmount.value ?? 0).isZero() ||
      new BigNumber(toTokenAmount.value ?? 0).isNaN()
    ) {
      infoRes.disable = true;
    }
    if (
      quoteLoading ||
      quoteEventFetching ||
      swapApprovingMatchLoading ||
      buildTxFetching
    ) {
      // if (swapApprovingMatchLoading) {
      //   infoRes.label = intl.formatMessage({
      //     id: ETranslations.swap_btn_approving,
      //   });
      // } else if (buildTxFetching) {
      //   infoRes.label = intl.formatMessage({
      //     id: ETranslations.swap_btn_building,
      //   });
      // } else {
      //   infoRes.label = intl.formatMessage({
      //     id: ETranslations.swap_page_button_fetching_quotes,
      //   });
      // }
      infoRes.disable = true;
    } else {
      // if (isCrossChain && fromToken && toToken) {
      //   infoRes.label = intl.formatMessage({
      //     id: ETranslations.swap_page_button_cross_chain,
      //   });
      // }
      // if (quoteCurrentSelect && quoteCurrentSelect.isWrapped) {
      //   infoRes.label = intl.formatMessage({
      //     id: ETranslations.swap_page_button_wrap,
      //   });
      // }
      // if (quoteCurrentSelect && quoteCurrentSelect.allowanceResult) {
      //   infoRes.label = intl.formatMessage({
      //     id: isBatchTransfer
      //       ? ETranslations.swap_page_approve_and_swap
      //       : ETranslations.global_approve,
      //   });
      // }
      if (
        quoteCurrentSelect &&
        !quoteCurrentSelect.toAmount &&
        !quoteCurrentSelect.limit
      ) {
        infoRes.label = intl.formatMessage({
          id: ETranslations.swap_page_alert_no_provider_supports_trade,
        });
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
        infoRes.label = intl.formatMessage({
          id: ETranslations.swap_page_button_insufficient_balance,
        });
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
    swapTypeSwitchValue,
    isRefreshQuote,
    toTokenAmount.value,
    quoteLoading,
    quoteEventFetching,
    swapApprovingMatchLoading,
    buildTxFetching,
    selectedFromTokenBalance,
    fromToken,
    toToken,
    quoteResultNoMatchDebounce,
    swapUseLimitPrice.rate,
  ]);
  const stepState: ISwapState = {
    label: actionInfo.label,
    isLoading: buildTxFetching,
    approving: swapApprovingMatchLoading,
    noConnectWallet: actionInfo.noConnectWallet,
    disabled:
      actionInfo.disable ||
      quoteLoading ||
      quoteEventFetching ||
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
  };
  return stepState;
}

export function useSwapSlippagePercentageModeInfo() {
  const [{ swapSlippagePercentageCustomValue, swapSlippagePercentageMode }] =
    useSettingsAtom();
  const [quoteResult] = useSwapQuoteCurrentSelectAtom();
  const res = useMemo(() => {
    let autoValue = swapSlippageAutoValue;
    let value = swapSlippageAutoValue;
    if (!isNil(quoteResult?.autoSuggestedSlippage)) {
      autoValue = quoteResult.autoSuggestedSlippage;
    }
    if (swapSlippagePercentageMode === ESwapSlippageSegmentKey.AUTO) {
      value = autoValue;
    } else {
      value = swapSlippagePercentageCustomValue;
    }
    return {
      slippageItem: {
        key: swapSlippagePercentageMode,
        value,
      },
      autoValue,
    };
  }, [
    quoteResult?.autoSuggestedSlippage,
    swapSlippagePercentageCustomValue,
    swapSlippagePercentageMode,
  ]);
  return res;
}
