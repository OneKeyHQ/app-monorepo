import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIsFocused } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { NumberSizeableText, SizableText } from '@onekeyhq/components';
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
  useSwapNetworksAtom,
  useSwapQuoteApproveAllowanceUnLimitAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteFetchingAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedFromTokenBalanceAtom,
  useSwapSilenceQuoteLoading,
} from '../../../states/jotai/contexts/swap';

import { useSwapAddressInfo } from './useSwapAccount';

function useSwapWarningCheck() {
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const [networks] = useSwapNetworksAtom();
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
    },
  });
  const isFocused = useIsFocused();
  const asyncRefContainer = useCallback(() => {
    if (refContainer.current.swapFromAddressInfo !== swapFromAddressInfo) {
      refContainer.current.swapFromAddressInfo = swapFromAddressInfo;
    }
  }, [swapFromAddressInfo]);

  useEffect(() => {
    if (isFocused) {
      asyncRefContainer();
      void checkSwapWarning(refContainer.current.swapFromAddressInfo);
    }
  }, [
    asyncRefContainer,
    checkSwapWarning,
    fromToken,
    fromTokenAmount,
    toToken,
    fromTokenBalance,
    quoteCurrentSelect,
    networks,
    isFocused,
  ]);
}

export function useSwapQuoteLoading() {
  const [quoteFetching] = useSwapQuoteFetchingAtom();
  const [silenceQuoteLoading] = useSwapSilenceQuoteLoading();
  return quoteFetching || silenceQuoteLoading;
}

export function useSwapActionState() {
  const intl = useIntl();
  const quoteLoading = useSwapQuoteLoading();
  const [quoteCurrentSelect] = useSwapQuoteCurrentSelectAtom();
  const [buildTxFetching] = useSwapBuildTxFetchingAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapQuoteApproveAllowanceUnLimit] =
    useSwapQuoteApproveAllowanceUnLimitAtom();
  useSwapWarningCheck();
  const [alerts] = useSwapAlertsAtom();
  const [selectedFromTokenBalance] = useSwapSelectedFromTokenBalanceAtom();
  const isCrossChain = fromToken?.networkId !== toToken?.networkId;
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const { getQuoteIntervalCount } = useSwapActions().current;
  const isRefreshQuote = getQuoteIntervalCount() >= swapQuoteIntervalMaxCount;
  const hasError = alerts.some(
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
  const quoteResultNoMatchDebounce = useDebounce(quoteResultNoMatch, 300);
  const actionInfo = useMemo(() => {
    const infoRes: {
      disable: boolean;
      label: string | ReactElement;
    } = {
      disable: !(!hasError && !!quoteCurrentSelect),
      label: intl.formatMessage({ id: ETranslations.swap_page_swap_button }),
    };
    if (quoteLoading) {
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
        infoRes.label = swapQuoteApproveAllowanceUnLimit ? (
          `${intl.formatMessage({
            id: ETranslations.swap_page_button_approve_unlimited,
          })} ${fromToken?.symbol ?? ''} to ${
            quoteCurrentSelect?.info.providerName ?? ''
          }`
        ) : (
          <SizableText>
            {intl.formatMessage({
              id: ETranslations.swap_page_provider_approve,
            })}
            {'  '}
            <NumberSizeableText formatter="balance">
              {fromTokenAmount}
            </NumberSizeableText>
            {` ${fromToken?.symbol ?? ''} to ${
              quoteCurrentSelect?.info.providerName ?? ''
            }`}
          </SizableText>
        );
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
    quoteLoading,
    quoteResultNoMatchDebounce,
    selectedFromTokenBalance,
    swapFromAddressInfo.address,
    swapQuoteApproveAllowanceUnLimit,
    swapToAddressInfo.address,
    toToken,
  ]);

  const stepState: ISwapState = {
    label: actionInfo.label,
    isLoading: buildTxFetching,
    disabled: actionInfo.disable || quoteLoading,
    approveUnLimit: swapQuoteApproveAllowanceUnLimit,
    isApprove: !!quoteCurrentSelect?.allowanceResult,
    isCrossChain,
    shoutResetApprove:
      !!quoteCurrentSelect?.allowanceResult?.shouldResetApprove,
    isWrapped: !!quoteCurrentSelect?.isWrapped,
    isRefreshQuote:
      (isRefreshQuote || quoteResultNoMatchDebounce) && !quoteLoading,
  };
  return stepState;
}
