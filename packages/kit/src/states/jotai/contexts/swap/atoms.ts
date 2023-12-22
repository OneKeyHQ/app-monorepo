import BigNumber from 'bignumber.js';

import {
  ESwapSlippageSegmentKey,
  ESwapStepStateType,
} from '../../../../views/Swap/types';
import { isOnlySupportSingleChainProvider } from '../../../../views/Swap/utils/utils';
import { createJotaiContext } from '../../utils/createJotaiContext';

import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  ISwapNetwork,
  ISwapSlippageSegmentItem,
  ISwapStepState,
  ISwapToken,
} from '../../../../views/Swap/types';

const {
  Provider: ProviderJotaiContextSwap,
  contextAtom,
  contextAtomComputed,
  contextAtomMethod,
} = createJotaiContext({ isSingletonStore: true });
export { ProviderJotaiContextSwap, contextAtomMethod };

// swap networks
export const { atom: swapNetworks, use: useSwapNetworksAtom } = contextAtom<
  ISwapNetwork[]
>([]);

// export const {
//   atom: swapNetworkTokenMapAtom,
//   use: useSwapNetworkTokenMapAtom,
// } = contextAtom<Record<string, ISwapToken[]>>({});

// swap select token
export const {
  atom: swapSelectFromTokenAtom,
  use: useSwapSelectFromTokenAtom,
} = contextAtom<ISwapToken | undefined>(undefined);

export const { atom: swapSelectToTokenAtom, use: useSwapSelectToTokenAtom } =
  contextAtom<ISwapToken | undefined>(undefined);

export const {
  atom: swapFromTokenAmountAtom,
  use: useSwapFromTokenAmountAtom,
} = contextAtom<string>('');

export const {
  atom: swapOnlySupportSingleChainAtom,
  use: useSwapOnlySupportSingleChainAtom,
} = contextAtomComputed((get) => {
  const fromToken = get(swapSelectFromTokenAtom());
  return fromToken && isOnlySupportSingleChainProvider(fromToken)
    ? fromToken.networkId
    : undefined;
});

// swap quote
export const {
  atom: swapManualSelectQuoteProvidersAtom,
  use: useSwapManualSelectQuoteProvidersAtom,
} = contextAtom<IFetchQuoteResult | undefined>(undefined);

export const { atom: swapQuoteListAtom, use: useSwapQuoteListAtom } =
  contextAtom<IFetchQuoteResult[]>([]);

export const { atom: swapQuoteFetchingAtom, use: useSwapQuoteFetchingAtom } =
  contextAtom<boolean>(false);

export const {
  atom: swapQuoteCurrentSelectAtom,
  use: useSwapResultQuoteCurrentSelectAtom,
} = contextAtomComputed((get) => {
  const list = get(swapQuoteListAtom());
  const manualSelectQuoteProviders = get(swapManualSelectQuoteProvidersAtom());
  return manualSelectQuoteProviders
    ? list.find(
        (item) =>
          item.info.provider === manualSelectQuoteProviders.info.provider,
      )
    : list[0];
});

// swap build_tx
export const {
  atom: swapSlippagePercentageAtom,
  use: useSwapSlippagePercentageAtom,
} = contextAtom<ISwapSlippageSegmentItem>({
  key: ESwapSlippageSegmentKey.AUTO,
  value: 0.5,
});

export const {
  atom: swapBuildTxFetchingAtom,
  use: useSwapBuildTxFetchingAtom,
} = contextAtom<boolean>(false);

export const { atom: swapBuildTxResultAtom, use: useSwapBuildTxResultAtom } =
  contextAtom<IFetchBuildTxResponse | undefined>(undefined);

// swap action state
export const { atom: swapStepStateAtom, use: useSwapStepStateAtom } =
  contextAtomComputed((get) => {
    const quoteFetching = get(swapQuoteFetchingAtom());
    const quoteCurrentSelect = get(swapQuoteCurrentSelectAtom());
    const buildTxFetching = get(swapBuildTxFetchingAtom());
    const fromTokenAmount = get(swapFromTokenAmountAtom());
    const fromToken = get(swapSelectFromTokenAtom());
    const toToken = get(swapSelectToTokenAtom());
    const isCrossChain = fromToken?.networkId !== toToken?.networkId;
    const stepState: ISwapStepState = {
      type: ESwapStepStateType.PRE,
      isLoading: quoteFetching,
      disabled: true,
      isCrossChain,
    };
    if (quoteFetching) {
      stepState.type = ESwapStepStateType.QUOTE;
      stepState.isLoading = true;
      return stepState;
    }
    if (!quoteCurrentSelect) {
      return stepState;
    }

    // check min max amount
    const fromTokenAmountBN = new BigNumber(fromTokenAmount);
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

    // Todo check account connect & balance
    if (quoteCurrentSelect.allowanceResult) {
      stepState.type = ESwapStepStateType.APPROVE;
      stepState.isLoading = false; // Todo check approve transaction state
      stepState.disabled = false;
      return stepState;
    }
    stepState.type = ESwapStepStateType.BUILD_TX;
    stepState.isLoading = buildTxFetching;
    stepState.disabled = buildTxFetching;
    return stepState;
  });
