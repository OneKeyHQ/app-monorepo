import { useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { swapQuoteIntervalMaxCount } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ISwapCheckWarningDef,
  ISwapState,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapAlertLevel,
  ESwapDirectionType,
} from '@onekeyhq/shared/types/swap/types';

import { useDebounce } from '../../../hooks/useDebounce';
import {
  useSwapActions,
  useSwapAlertsAtom,
  useSwapBuildTxFetchingAtom,
  useSwapFromTokenAmountAtom,
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

  useEffect(() => {
    if (isFocused) {
      asyncRefContainer();
      void checkSwapWarning(
        refContainer.current.swapFromAddressInfo,
        refContainer.current.swapToAddressInfo,
      );
    }
  }, [
    asyncRefContainer,
    checkSwapWarning,
    fromToken,
    fromTokenAmount,
    toToken,
    fromTokenBalance,
    quoteCurrentSelect,
    isFocused,
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
  return quoteEventTotalCount > 0 && quoteResult.length < quoteEventTotalCount;
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
  const [settingsPersistAtom] = useSettingsPersistAtom();
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
  const isRefreshQuote =
    quoteIntervalCount > swapQuoteIntervalMaxCount || shouldRefreshQuote;
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
      (quoteCurrentSelect?.allowanceResult &&
        quoteCurrentSelect.allowanceResult.amount !== fromTokenAmount),
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
      label: intl.formatMessage({ id: ETranslations.swap_page_swap_button }),
    };
    if (
      !swapFromAddressInfo.address ||
      !swapToAddressInfo.address ||
      quoteCurrentSelect?.fromAmount !== fromTokenAmount
    ) {
      infoRes.disable = true;
    }
    if (quoteLoading || quoteEventFetching) {
      infoRes.label = intl.formatMessage({
        id: ETranslations.swap_page_button_fetching_quotes,
      });
    } else {
      if (isCrossChain && fromToken && toToken) {
        infoRes.label = intl.formatMessage({
          id: ETranslations.swap_page_button_cross_chain,
        });
      }
      if (quoteCurrentSelect && quoteCurrentSelect.isWrapped) {
        infoRes.label = intl.formatMessage({
          id: ETranslations.swap_page_button_wrap,
        });
      }
      if (quoteCurrentSelect && quoteCurrentSelect.allowanceResult) {
        infoRes.label = intl.formatMessage({
          id: settingsPersistAtom.swapBatchApproveAndSwap
            ? ETranslations.swap_page_approve_and_swap
            : ETranslations.global_approve,
        });
      }
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
      const fromTokenAmountBN = new BigNumber(fromTokenAmount);
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
      if (!fromTokenAmount) {
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
    }
    return infoRes;
  }, [
    fromToken,
    fromTokenAmount,
    hasError,
    intl,
    isCrossChain,
    isRefreshQuote,
    quoteCurrentSelect,
    quoteEventFetching,
    quoteLoading,
    quoteResultNoMatchDebounce,
    selectedFromTokenBalance,
    settingsPersistAtom.swapBatchApproveAndSwap,
    swapFromAddressInfo.address,
    swapToAddressInfo.address,
    toToken,
  ]);

  const stepState: ISwapState = {
    label: actionInfo.label,
    isLoading: buildTxFetching,
    disabled: actionInfo.disable || quoteLoading || quoteEventFetching,
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
