import { useCallback, useEffect, useRef } from 'react';

import { useIsFocused } from '@react-navigation/core';

import { EPageType, usePageType } from '@onekeyhq/components';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import {
  ESwapApproveTransactionStatus,
  ESwapDirectionType,
  type ISwapApproveTransaction,
} from '@onekeyhq/shared/types/swap/types';

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
  const [swapSlippagePopoverOpening] = useSwapSlippageDialogOpeningAtom();
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

  const alignmentDecimal = useCallback(() => {
    const checkedDecimal = truncateDecimalPlaces(
      fromTokenAmount,
      fromToken?.decimals,
    );
    if (checkedDecimal && checkedDecimal !== fromTokenAmount) {
      setFromTokenAmount(checkedDecimal);
    }
  }, [fromToken?.decimals, fromTokenAmount, setFromTokenAmount]);

  useEffect(() => {
    if (swapSlippagePopoverOpening || swapApproveAllowanceSelectOpen) {
      cleanQuoteInterval();
    } else {
      void recoverQuoteInterval(activeAccountAddressRef.current);
    }
  }, [
    cleanQuoteInterval,
    recoverQuoteInterval,
    swapApproveAllowanceSelectOpen,
    swapSlippagePopoverOpening,
  ]);

  useEffect(() => {
    if (
      swapApprovingTransactionAtom &&
      swapApprovingTransactionAtom.txId &&
      swapApprovingTransactionAtom.status ===
        ESwapApproveTransactionStatus.SUCCESS
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
    fromToken,
    toToken,
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
