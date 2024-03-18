import { useEffect, useRef } from 'react';

import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { ETabRoutes } from '../../../routes/Tab/type';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapApprovingTransactionAtom,
  useSwapFromTokenAmountAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSlippagePopoverOpeningAtom,
} from '../../../states/jotai/contexts/swap';

export function useSwapQuote() {
  const { quoteAction, cleanQuoteInterval } = useSwapActions().current;
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapSlippagePopoverOpening] = useSwapSlippagePopoverOpeningAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [swapApprovingTransactionAtom] = useSwapApprovingTransactionAtom();
  const activeAccountAddressRef = useRef<string | undefined>();
  if (activeAccountAddressRef.current !== activeAccount?.account?.address) {
    activeAccountAddressRef.current = activeAccount?.account?.address;
  }

  useEffect(() => {
    if (!swapSlippagePopoverOpening) {
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
    swapSlippagePopoverOpening,
  ]);

  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (isFocus && !isHiddenModel) {
        void quoteAction(activeAccountAddressRef.current);
      } else {
        cleanQuoteInterval();
      }
    },
  );
}
