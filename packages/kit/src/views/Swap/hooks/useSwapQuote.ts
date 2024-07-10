import { useCallback, useEffect, useRef } from 'react';

import { useIsFocused } from '@react-navigation/core';

import { EPageType, usePageType } from '@onekeyhq/components';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import {
  ESwapApproveTransactionStatus,
  ESwapDirectionType,
  type ISwapApproveTransaction,
} from '@onekeyhq/shared/types/swap/types';

import { useDebounce } from '../../../hooks/useDebounce';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import {
  useSwapActions,
  useSwapApproveAllowanceSelectOpenAtom,
  useSwapFromTokenAmountAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSlippageDialogOpeningAtom,
} from '../../../states/jotai/contexts/swap';
import { truncateDecimalPlaces } from '../utils/utils';

import { useSwapAddressInfo } from './useSwapAccount';

export function useSwapQuote() {
  const { quoteAction, cleanQuoteInterval, recoverQuoteInterval } =
    useSwapActions().current;
  const swapAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapSlippageDialogOpening] = useSwapSlippageDialogOpeningAtom();
  const [swapApproveAllowanceSelectOpen] =
    useSwapApproveAllowanceSelectOpenAtom();
  const [fromTokenAmount, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [{ swapApprovingTransaction }] = useInAppNotificationAtom();
  const activeAccountRef = useRef<
    ReturnType<typeof useSwapAddressInfo> | undefined
  >();
  if (activeAccountRef.current !== swapAddressInfo) {
    activeAccountRef.current = swapAddressInfo;
  }
  const swapApprovingTxRef = useRef<ISwapApproveTransaction | undefined>();
  if (swapApprovingTxRef.current !== swapApprovingTransaction) {
    swapApprovingTxRef.current = swapApprovingTransaction;
  }
  const fromAmountDebounce = useDebounce(fromTokenAmount, 500);
  const alignmentDecimal = useCallback(() => {
    const checkedDecimal = truncateDecimalPlaces(
      fromAmountDebounce,
      fromToken?.decimals,
    );
    if (checkedDecimal && checkedDecimal !== fromAmountDebounce) {
      setFromTokenAmount(checkedDecimal);
    }
  }, [fromToken?.decimals, fromAmountDebounce, setFromTokenAmount]);

  useEffect(() => {
    if (swapSlippageDialogOpening.status || swapApproveAllowanceSelectOpen) {
      cleanQuoteInterval();
    } else if (swapSlippageDialogOpening.flag !== 'save') {
      void recoverQuoteInterval(
        activeAccountRef.current?.address,
        activeAccountRef.current?.accountInfo?.account?.id,
      );
    }
  }, [
    cleanQuoteInterval,
    recoverQuoteInterval,
    swapApproveAllowanceSelectOpen,
    swapSlippageDialogOpening,
  ]);

  useEffect(() => {
    if (
      swapApprovingTransaction &&
      swapApprovingTransaction.txId &&
      swapApprovingTransaction.status ===
        ESwapApproveTransactionStatus.SUCCESS &&
      !swapApprovingTransaction.resetApproveValue
    ) {
      void quoteAction(
        activeAccountRef.current?.address,
        activeAccountRef.current?.accountInfo?.account?.id,
        swapApprovingTransaction.blockNumber,
      );
    }
  }, [cleanQuoteInterval, quoteAction, swapApprovingTransaction]);

  useEffect(() => {
    if (fromToken?.networkId !== activeAccountRef.current?.networkId) {
      return;
    }
    alignmentDecimal();
    void quoteAction(
      activeAccountRef.current?.address,
      activeAccountRef.current?.accountInfo?.account?.id,
    );
    return () => {
      cleanQuoteInterval();
    };
  }, [
    cleanQuoteInterval,
    quoteAction,
    swapAddressInfo.address,
    swapAddressInfo.networkId,
    fromToken,
    toToken?.networkId,
    toToken?.contractAddress,
    alignmentDecimal,
  ]);

  const pageType = usePageType();
  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (pageType !== EPageType.modal) {
        if (isFocus && !isHiddenModel && !swapApprovingTxRef.current?.txId) {
          void recoverQuoteInterval(
            activeAccountRef.current?.address,
            activeAccountRef.current?.accountInfo?.account?.id,
          );
        } else {
          cleanQuoteInterval();
        }
      }
    },
  );

  const isFocused = useIsFocused();
  useEffect(() => {
    if (pageType === EPageType.modal) {
      if (isFocused && !swapApprovingTxRef.current?.txId) {
        void recoverQuoteInterval(
          activeAccountRef.current?.address,
          activeAccountRef.current?.accountInfo?.account?.id,
        );
      } else {
        cleanQuoteInterval();
      }
    }
  }, [cleanQuoteInterval, isFocused, pageType, recoverQuoteInterval]);
}
