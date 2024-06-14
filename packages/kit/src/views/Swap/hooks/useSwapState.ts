import { useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  ISwapCheckWarningDef,
  ISwapState,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapAlertLevel,
  ESwapDirectionType,
} from '@onekeyhq/shared/types/swap/types';

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
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
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
    swapToAddressInfo: {
      address: undefined,
      networkId: undefined,
      accountInfo: undefined,
    },
  });

  const asyncRefContainer = useCallback(() => {
    if (refContainer.current.swapFromAddressInfo !== swapFromAddressInfo) {
      refContainer.current.swapFromAddressInfo = swapFromAddressInfo;
    }
    if (refContainer.current.swapToAddressInfo !== swapToAddressInfo) {
      refContainer.current.swapToAddressInfo = swapToAddressInfo;
    }
  }, [swapFromAddressInfo, swapToAddressInfo]);

  useEffect(() => {
    asyncRefContainer();
    void checkSwapWarning(
      refContainer.current.swapFromAddressInfo,
      refContainer.current.swapToAddressInfo,
    );
  }, [
    asyncRefContainer,
    checkSwapWarning,
    fromToken,
    fromTokenAmount,
    toToken,
    fromTokenBalance,
    quoteCurrentSelect,
    networks,
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
  const hasError = alerts.some(
    (item) => item.alertLevel === ESwapAlertLevel.ERROR,
  );
  const actionInfo = useMemo(() => {
    const infoRes = {
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
        infoRes.label = swapQuoteApproveAllowanceUnLimit
          ? `${intl.formatMessage({
              id: ETranslations.swap_page_button_approve_unlimited,
            })} ${fromToken?.symbol ?? ''} to ${
              quoteCurrentSelect?.info.providerName ?? ''
            }`
          : `${intl.formatMessage({
              id: ETranslations.swap_page_provider_approve,
            })}  ${
              numberFormat(fromTokenAmount, {
                formatter: 'balance',
              }) as string
            } ${fromToken?.symbol ?? ''} to ${
              quoteCurrentSelect?.info.providerName ?? ''
            }`;
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
      const balanceBN = new BigNumber(selectedFromTokenBalance ?? 0);
      const fromTokenAmountBN = new BigNumber(fromTokenAmount);
      // const reserveBN = new BigNumber(fromToken?.reservationValue ?? 0);
      // const afterReserveBalance = balanceBN.minus(reserveBN);
      // if (
      //   afterReserveBalance.lt(0) ||
      //   fromTokenAmountBN.gt(afterReserveBalance)
      // ) {
      //   infoRes.label = intl.formatMessage({
      //     id: ETranslations.swap_page_button_no_enough_fee,
      //   });
      //   infoRes.disable = true;
      // }
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
    }
    return infoRes;
  }, [
    fromToken,
    fromTokenAmount,
    hasError,
    intl,
    isCrossChain,
    quoteCurrentSelect,
    quoteLoading,
    selectedFromTokenBalance,
    swapFromAddressInfo.address,
    swapQuoteApproveAllowanceUnLimit,
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
  };
  return stepState;
}
