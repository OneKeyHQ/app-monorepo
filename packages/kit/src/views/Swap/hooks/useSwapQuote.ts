import { useCallback, useState } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '../../../states/jotai/contexts/swap';

import type { IFetchQuoteResponse } from '../types';

export function useSwapQuote() {
  const [quoteFetching, setQuoteFetching] = useState(false);
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [quotes, setQuotes] = useState<IFetchQuoteResponse[]>([]);
  const [selectQuote, setSelectQuote] = useState<
    IFetchQuoteResponse | undefined
  >();
  const quoteFetch = useCallback(
    async (fromAmount: number) => {
      if (Number.isNaN(fromAmount) || fromAmount === 0) {
        if (quoteFetching)
          await backgroundApiProxy.serviceSwap.cancelFetchQuotes();
        setQuoteFetching(false);
        setQuotes([]);
        return;
      }

      if (fromToken && toToken) {
        try {
          setQuoteFetching(true);
          const res = await backgroundApiProxy.serviceSwap.fetchQuotes({
            fromToken,
            toToken,
            fromTokenAmount: fromAmount.toFixed(6),
          });
          if (res && res?.length > 0) {
            setQuotes(res);
            if (!selectQuote) {
              setSelectQuote(res[0]);
            }
          }
          setQuoteFetching(false);
        } catch (e: any) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (e?.message !== 'cancel') {
            setQuoteFetching(false);
          }
        }
      }
    },
    [fromToken, quoteFetching, selectQuote, toToken],
  );
  return {
    quoteFetching,
    quotes,
    quoteFetch,
    selectQuote,
    setSelectQuote,
  };
}
