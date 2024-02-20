import { useEffect, useRef } from 'react';

import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { ETabRoutes } from '../../../routes/Tab/type';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '../../../states/jotai/contexts/swap';

export function useSwapQuote() {
  const { quoteAction, cleanQuoteInterval } = useSwapActions().current;
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const activeAccountAddressRef = useRef<string | undefined>();
  if (activeAccountAddressRef.current !== activeAccount?.account?.address) {
    activeAccountAddressRef.current = activeAccount?.account?.address;
  }

  useEffect(() => {
    void quoteAction(activeAccountAddressRef.current);
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
