import { useCallback, useEffect, useRef } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { ETabRoutes } from '../../../routes/Tab/type';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapQuoteFetchingAtom,
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '../../../states/jotai/contexts/swap';
import { swapQuoteFetchInterval } from '../config/SwapProvider.constants';

export function useSwapQuote() {
  const [, setQuoteFetching] = useSwapQuoteFetchingAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [, setQuoteList] = useSwapQuoteListAtom();
  const intervalRef = useRef<NodeJS.Timeout>();
  const { runQuote } = useSwapActions().current;
  const [formTokenAmount] = useSwapFromTokenAmountAtom();
  const formTokenAmountRef = useRef('');
  if (formTokenAmountRef.current !== formTokenAmount) {
    formTokenAmountRef.current = formTokenAmount;
  }
  const quoteFetch = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (
      fromToken &&
      toToken &&
      !Number.isNaN(Number(formTokenAmountRef.current)) &&
      Number(formTokenAmountRef.current) > 0
    ) {
      void runQuote();
      intervalRef.current = setInterval(() => {
        void runQuote();
      }, swapQuoteFetchInterval);
    } else {
      await backgroundApiProxy.serviceSwap.cancelQuoteFetchQuotes();
      setQuoteFetching(false);
      setQuoteList([]);
    }
  }, [fromToken, runQuote, setQuoteFetching, setQuoteList, toToken]);

  useEffect(() => {
    void quoteFetch();
    return () => {
      clearInterval(intervalRef.current);
    };
  }, [quoteFetch]);

  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (isFocus && !isHiddenModel) {
        void quoteFetch();
      } else {
        clearInterval(intervalRef.current);
      }
    },
  );

  return {
    quoteFetch,
  };
}
