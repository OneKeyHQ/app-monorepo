import BigNumber from 'bignumber.js';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapBuildTxFetchingAtom,
  useSwapFromTokenAmountAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteFetchingAtom,
  useSwapQuoteTokenMarketingRateWarningAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '../../../states/jotai/contexts/swap';
import { ESwapStepStateType } from '../types';

import type { ISwapStepState } from '../types';

export function useSwapStepState() {
  const [quoteFetching] = useSwapQuoteFetchingAtom();
  const [quoteCurrentSelect] = useSwapQuoteCurrentSelectAtom();
  const [buildTxFetching] = useSwapBuildTxFetchingAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [rateWarning] = useSwapQuoteTokenMarketingRateWarningAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const isCrossChain = fromToken?.networkId !== toToken?.networkId;
  const stepState: ISwapStepState = {
    type: ESwapStepStateType.PRE,
    isLoading: quoteFetching,
    disabled: true,
    isCrossChain,
    rateWarning,
  };
  if (quoteFetching) {
    stepState.type = ESwapStepStateType.QUOTE;
    stepState.isLoading = true;
    return stepState;
  }
  if (!quoteCurrentSelect) {
    return stepState;
  }
  const fromTokenAmountBN = new BigNumber(fromTokenAmount);

  // check account
  if (!activeAccount.account?.address) {
    stepState.type = ESwapStepStateType.ACCOUNT_CHECK;
    stepState.isLoading = false;
    stepState.disabled = true;
    stepState.wrongMsg = `Please connect your wallet`;
    return stepState;
  }
  const balanceBN = new BigNumber(fromToken?.balanceParsed ?? 0);
  if (balanceBN.comparedTo(fromTokenAmountBN) !== 1) {
    stepState.type = ESwapStepStateType.ACCOUNT_CHECK;
    stepState.isLoading = false;
    stepState.disabled = true;
    stepState.wrongMsg = `Insufficient balance`;
    return stepState;
  }

  // check min max amount
  if (quoteCurrentSelect.limit?.min) {
    const minAmountBN = new BigNumber(quoteCurrentSelect.limit.min);
    if (fromTokenAmountBN.lt(minAmountBN)) {
      stepState.type = ESwapStepStateType.QUOTE;
      stepState.isLoading = false;
      stepState.disabled = true;
      stepState.wrongMsg = `Minimum amount is ${minAmountBN.toFixed()}`;
      return stepState;
    }
  }
  if (quoteCurrentSelect.limit?.max) {
    const maxAmountBN = new BigNumber(quoteCurrentSelect.limit.max);
    if (fromTokenAmountBN.gt(maxAmountBN)) {
      stepState.type = ESwapStepStateType.QUOTE;
      stepState.isLoading = false;
      stepState.disabled = true;
      stepState.wrongMsg = `Maximum amount is ${maxAmountBN.toFixed()}`;
      return stepState;
    }
  }

  if (quoteCurrentSelect.allowanceResult) {
    stepState.type = ESwapStepStateType.APPROVE;
    stepState.shoutResetApprove =
      !!quoteCurrentSelect.allowanceResult.shouldResetApprove;
    stepState.isLoading = false; // Todo check approve transaction state
    stepState.disabled = false;
    return stepState;
  }
  stepState.type = ESwapStepStateType.BUILD_TX;
  stepState.isLoading = buildTxFetching;
  stepState.isWrapped = !!quoteCurrentSelect.isWrapped;
  stepState.disabled = buildTxFetching;
  return stepState;
}
