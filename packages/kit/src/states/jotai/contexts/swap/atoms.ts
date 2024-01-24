import BigNumber from 'bignumber.js';

import {
  ESwapReceiveAddressType,
  ESwapSlippageSegmentKey,
  ESwapTxHistoryStatus,
} from '@onekeyhq/kit/src/views/Swap/types';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  ISwapNetwork,
  ISwapSlippageSegmentItem,
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
  use: useSwapQuoteCurrentSelectAtom,
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
  use: useSwapQuoteTokenMarketingRateWarningAtom,
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
  if (quoteRateBN.isZero()) {
    return 'amount too small to quote rate is zero';
  }
  if (difference.comparedTo(5) === 1) {
    return `rate difference high ${difference.decimalPlaces(2).toFixed()}%`;
  }
  return '';
});

export const {
  atom: swapProviderSupportReceiveAddressAtom,
  use: useSwapProviderSupportReceiveAddressAtom,
} = contextAtomComputed((get) => {
  const quoteResult = get(swapQuoteCurrentSelectAtom());
  if (!quoteResult) {
    return true;
  }
  return (
    !quoteResult.unSupportReceiveAddressDifferent && !quoteResult.isWrapped
  );
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

// swap receiver address

export const {
  atom: swapReceiverAddressTypeAtom,
  use: useSwapReceiverAddressTypeAtom,
} = contextAtom<ESwapReceiveAddressType>(ESwapReceiveAddressType.USER_ACCOUNT);

export const {
  atom: swapReceiverAddressInputValueAtom,
  use: useSwapReceiverAddressInputValueAtom,
} = contextAtom<string>('');

export const {
  atom: swapReceiverAddressBookValueAtom,
  use: useSwapReceiverAddressBookValueAtom,
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
