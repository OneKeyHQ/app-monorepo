import { useCallback, useEffect, useRef } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { ETabRoutes } from '../../../routes/Tab/type';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapFromTokenAmountAtom,
  useSwapQuoteFetchingAtom,
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSlippagePercentageAtom,
} from '../../../states/jotai/contexts/swap';
import { swapQuoteFetchInterval } from '../config/SwapProvider.constants';

export function useSwapQuote() {
  const [, setQuoteFetching] = useSwapQuoteFetchingAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [, setQuoteList] = useSwapQuoteListAtom();
  const [swapSlippage] = useSwapSlippagePercentageAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const intervalRef = useRef<NodeJS.Timeout>();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();

  const runFetch = useCallback(
    async (fromAmount: number) => {
      if (!fromToken || !toToken) return;
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

  const quoteFetch = useCallback(async () => {
    const fromTokenAmountNumber = Number(fromTokenAmount);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (
      fromToken &&
      toToken &&
      !Number.isNaN(fromTokenAmountNumber) &&
      fromTokenAmountNumber !== 0
    ) {
      void runFetch(fromTokenAmountNumber);
      intervalRef.current = setInterval(() => {
        void runFetch(fromTokenAmountNumber);
      }, swapQuoteFetchInterval);
    } else {
      await backgroundApiProxy.serviceSwap.cancelQuoteFetchQuotes();
      setQuoteFetching(false);
      setQuoteList([]);
    }
  }, [
    fromToken,
    fromTokenAmount,
    runFetch,
    setQuoteFetching,
    setQuoteList,
    toToken,
  ]);

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
