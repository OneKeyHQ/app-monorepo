import { useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';

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
      label: 'Swap',
    };
    if (quoteLoading) {
      infoRes.label = 'Fetching quotes';
    } else {
      if (isCrossChain && fromToken && toToken) {
        infoRes.label = 'Cross-Chain Swap';
      }
      if (quoteCurrentSelect && quoteCurrentSelect.isWrapped) {
        infoRes.label = 'Wrapped';
      }
      if (quoteCurrentSelect && quoteCurrentSelect.allowanceResult) {
        infoRes.label = swapQuoteApproveAllowanceUnLimit
          ? `Approve Unlimited ${fromToken?.symbol ?? ''} to ${
              quoteCurrentSelect?.info.providerName ?? ''
            }`
          : `Approve  ${fromTokenAmount} ${fromToken?.symbol ?? ''} to ${
              quoteCurrentSelect?.info.providerName ?? ''
            }`;
      }
      const fromTokenAmountBN = new BigNumber(fromTokenAmount);
      const balanceBN = new BigNumber(selectedFromTokenBalance ?? 0);
      if (
        fromToken &&
        swapFromAddressInfo.address &&
        balanceBN.lt(fromTokenAmountBN)
      ) {
        infoRes.label = 'Insufficient balance';
        infoRes.disable = true;
      }
    }
    return infoRes;
  }, [
    fromToken,
    fromTokenAmount,
    hasError,
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
    isLoading: buildTxFetching || quoteLoading,
    disabled: actionInfo.disable,
    approveUnLimit: swapQuoteApproveAllowanceUnLimit,
    isApprove: !!quoteCurrentSelect?.allowanceResult,
    isCrossChain,
    shoutResetApprove:
      !!quoteCurrentSelect?.allowanceResult?.shouldResetApprove,
    isWrapped: !!quoteCurrentSelect?.isWrapped,
  };
  return stepState;
}
