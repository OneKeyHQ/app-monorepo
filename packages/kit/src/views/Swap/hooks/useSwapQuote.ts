import { useCallback } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useSwapQuoteFetchingAtom,
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSlippagePercentageAtom,
} from '../../../states/jotai/contexts/swap';
import { mockAddress } from '../utils/utils';

export function useSwapQuote() {
  const [quoteFetching, setQuoteFetching] = useSwapQuoteFetchingAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [, setQuoteList] = useSwapQuoteListAtom();
  const [swapSlippage] = useSwapSlippagePercentageAtom();
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
            userAddress: mockAddress,
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
    [fromToken, setQuoteFetching, setQuoteList, swapSlippage.value, toToken],
  );
  return {
    quoteFetching,
    quoteFetch,
  };
}
