import { useEffect, useRef } from 'react';

import type { ISwapApproveTransaction } from '@onekeyhq/shared/types/swap/types';

import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { ETabRoutes } from '../../../routes/Tab/type';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapApproveAllowanceSelectOpenAtom,
  useSwapApprovingTransactionAtom,
  useSwapFromTokenAmountAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSlippagePopoverOpeningAtom,
} from '../../../states/jotai/contexts/swap';

export function useSwapQuote() {
  const { quoteAction, cleanQuoteInterval, recoverQuoteInterval } =
    useSwapActions().current;
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapSlippagePopoverOpening] = useSwapSlippagePopoverOpeningAtom();
  const [swapApproveAllowanceSelectOpen] =
    useSwapApproveAllowanceSelectOpenAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [swapApprovingTransactionAtom] = useSwapApprovingTransactionAtom();
  const activeAccountAddressRef = useRef<string | undefined>();
  if (activeAccountAddressRef.current !== activeAccount?.account?.address) {
    activeAccountAddressRef.current = activeAccount?.account?.address;
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
    } else {
      cleanQuoteInterval();
    }
    return () => {
      cleanQuoteInterval();
    };
  }, [
    cleanQuoteInterval,
    quoteAction,
    activeAccount,
    fromToken,
    toToken,
    fromTokenAmount,
    swapApprovingTransactionAtom,
  ]);

  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (isFocus && !isHiddenModel && !swapApprovingTxRef.current) {
        void quoteAction(activeAccountAddressRef.current);
      } else {
        cleanQuoteInterval();
      }
    },
  );
}
