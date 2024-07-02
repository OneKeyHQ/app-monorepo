import { useCallback, useEffect, useRef } from 'react';

import { useIsFocused } from '@react-navigation/core';

import { EPageType, usePageType } from '@onekeyhq/components';
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
  useSwapApprovingTransactionAtom,
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
  const [swapApprovingTransactionAtom] = useSwapApprovingTransactionAtom();
  const activeAccountAddressRef = useRef<string | undefined>();
  const activeAccountNetworkIdRef = useRef<string | undefined>();
  if (activeAccountAddressRef.current !== swapAddressInfo?.address) {
    activeAccountAddressRef.current = swapAddressInfo?.address;
  }
  if (activeAccountNetworkIdRef.current !== swapAddressInfo.networkId) {
    activeAccountNetworkIdRef.current = swapAddressInfo.networkId;
  }
  const swapApprovingTxRef = useRef<ISwapApproveTransaction | undefined>();
  if (swapApprovingTxRef.current !== swapApprovingTransactionAtom) {
    swapApprovingTxRef.current = swapApprovingTransactionAtom;
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
    if (swapSlippageDialogOpening || swapApproveAllowanceSelectOpen) {
      cleanQuoteInterval();
    } else {
      void recoverQuoteInterval(activeAccountAddressRef.current);
    }
  }, [
    cleanQuoteInterval,
    recoverQuoteInterval,
    swapApproveAllowanceSelectOpen,
    swapSlippageDialogOpening,
  ]);

  useEffect(() => {
    if (
      swapApprovingTransactionAtom &&
      swapApprovingTransactionAtom.txId &&
      swapApprovingTransactionAtom.status ===
        ESwapApproveTransactionStatus.SUCCESS &&
      !swapApprovingTransactionAtom.resetApproveValue
    ) {
      void quoteAction(
        activeAccountAddressRef.current,
        swapApprovingTransactionAtom.blockNumber,
      );
    }
  }, [cleanQuoteInterval, quoteAction, swapApprovingTransactionAtom]);

  useEffect(() => {
    if (fromToken?.networkId !== activeAccountNetworkIdRef.current) {
      return;
    }
    alignmentDecimal();
    void quoteAction(activeAccountAddressRef.current);
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
          void recoverQuoteInterval(activeAccountAddressRef.current);
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
        void recoverQuoteInterval(activeAccountAddressRef.current);
      } else {
        cleanQuoteInterval();
      }
    }
  }, [cleanQuoteInterval, isFocused, pageType, recoverQuoteInterval]);
}
