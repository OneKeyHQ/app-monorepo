import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useSwapQuoteFetchingAtom,
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '../../../states/jotai/contexts/swap';
import { mockAddress } from '../utils/utils';

export function useSwapQuote() {
  const [quoteFetching, setQuoteFetching] = useSwapQuoteFetchingAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [, setQuoteList] = useSwapQuoteListAtom();
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
          });
          if (res && res?.length > 0) {
            res.sort((a, b) => {
              const bBN = new BigNumber(b.toAmount);
              const aBN = new BigNumber(a.toAmount);
              return bBN.comparedTo(aBN);
            });
            setQuoteList(res);
          }
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
    [fromToken, setQuoteFetching, setQuoteList, toToken],
  );
  return {
    quoteFetching,
    quoteFetch,
  };
}
