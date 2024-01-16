import BigNumber from 'bignumber.js';

import {
  ESwapSlippageSegmentKey,
  ESwapStepStateType,
  ESwapTxHistoryStatus,
} from '@onekeyhq/kit/src/views/Swap/types';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  ISwapNetwork,
  ISwapSlippageSegmentItem,
  ISwapStepState,
  ISwapToken,
  ISwapTxHistory,
} from '@onekeyhq/kit/src/views/Swap/types';
import { isOnlySupportSingleChainProvider } from '@onekeyhq/kit/src/views/Swap/utils/utils';

import { createJotaiContext } from '../../utils/createJotaiContext';

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

export const {
  atom: swapQuoteTokenMarketingRateWarningAtom,
  use: useSwapQuoteRateMarketingRateWarningAtom,
} = contextAtomComputed((get) => {
  const fromToken = get(swapSelectFromTokenAtom());
  const toToken = get(swapSelectToTokenAtom());
  const quoteResult = get(swapQuoteCurrentSelectAtom());
  if (!quoteResult) {
    return '';
  }
  if (!fromToken?.price || !toToken?.price) {
    return 'no price';
  }
  const fromTokenPrice = new BigNumber(fromToken.price);
  const toTokenPrice = new BigNumber(toToken.price);
  const marketingRate = fromTokenPrice.dividedBy(toTokenPrice).decimalPlaces(6);
  const quoteRateBN = new BigNumber(quoteResult.instantRate);
  const difference = marketingRate
    .dividedBy(quoteRateBN)
    .minus(1)
    .multipliedBy(100);
  if (difference.comparedTo(5) === 1) {
    return `rate difference high ${difference.decimalPlaces(2).toFixed()}%`;
  }
  return '';
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
    const rateWarning = get(swapQuoteTokenMarketingRateWarningAtom());
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
    stepState.isWrapped = !!quoteCurrentSelect.isWrapped;
    stepState.disabled = buildTxFetching;
    return stepState;
  });

export const {
  atom: swapReceiverAddressAtom,
  use: useSwapReceiverAddressAtom,
} = contextAtom<string>('');

// swap tx history
export const { atom: swapTxHistoryAtom, use: useSwapTxHistoryAtom } =
  contextAtom<ISwapTxHistory[]>([]);

export const {
  atom: swapTxHistoryStatusChangeAtom,
  use: useSwapTxHistoryStatusChangeAtom,
} = contextAtom<ISwapTxHistory[]>([]);

export const {
  atom: swapTxHistoryPendingAtom,
  use: useSwapTxHistoryPendingAtom,
} = contextAtomComputed((get) => {
  const list = get(swapTxHistoryAtom());
  get(swapTxHistoryStatusChangeAtom());
  return list.filter((item) => item.status === ESwapTxHistoryStatus.PENDING);
});
