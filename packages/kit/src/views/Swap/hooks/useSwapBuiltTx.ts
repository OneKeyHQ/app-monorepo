import { useCallback } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useSwapBuildTxFetchingAtom,
  useSwapBuildTxResultAtom,
  useSwapFromTokenAmountAtom,
  useSwapResultQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSlippagePercentageAtom,
} from '../../../states/jotai/contexts/swap';
import { mockAddress } from '../utils/utils';

export function useSwapBuildTx() {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [slippagePercentage] = useSwapSlippagePercentageAtom();
  const [selectQuote] = useSwapResultQuoteCurrentSelectAtom();
  const [, setSwapBuildTxFetching] = useSwapBuildTxFetchingAtom();
  const [, setSwapBuildTxResult] = useSwapBuildTxResultAtom();
  const wrappedTx = useCallback(async () => {
    // todo wrapped tx
  }, []);
  const approveTx = useCallback(async (allowanceNumber: number) => {
    // todo approve tx
  }, []);
  const buildTx = useCallback(async () => {
    if (
      fromToken &&
      toToken &&
      fromTokenAmount &&
      slippagePercentage &&
      selectQuote
    ) {
      setSwapBuildTxFetching(true);
      const res = await backgroundApiProxy.serviceSwap.fetchBuildTx({
        fromToken,
        toToken,
        toTokenAmount: selectQuote.toAmount,
        fromTokenAmount,
        slippagePercentage: slippagePercentage.value,
        receivingAddress: mockAddress,
        userAddress: mockAddress,
        provider: selectQuote.info.provider,
      });
      setSwapBuildTxResult(res);
      setSwapBuildTxFetching(false);
      return res;
    }
  }, [
    fromToken,
    fromTokenAmount,
    selectQuote,
    setSwapBuildTxFetching,
    setSwapBuildTxResult,
    slippagePercentage,
    toToken,
  ]);

  return { buildTx, wrappedTx, approveTx };
}
