import { useCallback } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapQuoteFetchingAtom,
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSlippagePercentageAtom,
} from '../../../states/jotai/contexts/swap';

export function useSwapQuote() {
  const [quoteFetching, setQuoteFetching] = useSwapQuoteFetchingAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [, setQuoteList] = useSwapQuoteListAtom();
  const [swapSlippage] = useSwapSlippagePercentageAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const quoteFetch = useCallback(
    async (fromAmount: number) => {
      if (
        fromToken &&
        toToken &&
        !Number.isNaN(fromAmount) &&
        fromAmount !== 0
      ) {
        try {
          setQuoteFetching(true);
          const res = await backgroundApiProxy.serviceSwap.fetchQuotes({
            fromToken,
            toToken,
            fromTokenAmount: fromAmount.toString(),
            userAddress: activeAccount.account?.address,
            slippagePercentage: swapSlippage.value,
          });
          setQuoteList(res);
          setQuoteFetching(false);
        } catch (e: any) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (e?.message !== 'cancel') {
            setQuoteFetching(false);
          }
        }
      } else {
        await backgroundApiProxy.serviceSwap.cancelQuoteFetchQuotes();
        setQuoteFetching(false);
        setQuoteList([]);
      }
    },
    [
      activeAccount.account?.address,
      fromToken,
      setQuoteFetching,
      setQuoteList,
      swapSlippage.value,
      toToken,
    ],
  );
  return {
    quoteFetching,
    quoteFetch,
  };
}
