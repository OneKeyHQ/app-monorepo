import { useEffect, useRef } from 'react';

import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import {
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
  useSwapSlippagePopoverOpeningAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapAddressInfo } from './useSwapAccount';

export function useSwapQuote() {
  const { quoteAction, cleanQuoteInterval, recoverQuoteInterval } =
    useSwapActions().current;
  const swapAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapSlippagePopoverOpening] = useSwapSlippagePopoverOpeningAtom();
  const [swapApproveAllowanceSelectOpen] =
    useSwapApproveAllowanceSelectOpenAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [swapApprovingTransactionAtom] = useSwapApprovingTransactionAtom();
  const activeAccountAddressRef = useRef<string | undefined>();
  if (activeAccountAddressRef.current !== swapAddressInfo?.address) {
    activeAccountAddressRef.current = swapAddressInfo?.address;
  }

  const swapApprovingTxRef = useRef<ISwapApproveTransaction | undefined>();
  if (swapApprovingTxRef.current !== swapApprovingTransactionAtom) {
    swapApprovingTxRef.current = swapApprovingTransactionAtom;
  }

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
    if (!swapApprovingTransactionAtom) {
      void quoteAction(activeAccountAddressRef.current);
    }
  }, [cleanQuoteInterval, quoteAction, swapApprovingTransactionAtom]);

  useEffect(() => {
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
    fromTokenAmount,
  ]);

  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (isFocus && !isHiddenModel && !swapApprovingTxRef.current?.txId) {
        void recoverQuoteInterval(activeAccountAddressRef.current);
      } else {
        cleanQuoteInterval();
      }
    },
  );
}
