import BigNumber from 'bignumber.js';

import { ESwapProviderSort } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  ESwapReceiveAddressType,
  ESwapSlippageSegmentKey,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import type {
  ESwapRateDifferenceUnit,
  IFetchQuoteResult,
  ISwapAlertState,
  ISwapApproveTransaction,
  ISwapNetwork,
  ISwapSlippageSegmentItem,
  ISwapToken,
  ISwapTokenCatch,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

import { createJotaiContext } from '../../utils/createJotaiContext';

import type { IAccountSelectorActiveAccountInfo } from '../accountSelector';

const {
  Provider: ProviderJotaiContextSwap,
  contextAtom,
  contextAtomComputed,
  contextAtomMethod,
} = createJotaiContext();
export { ProviderJotaiContextSwap, contextAtomMethod };

// swap networks & tokens
export const { atom: swapNetworks, use: useSwapNetworksAtom } = contextAtom<
  ISwapNetwork[]
>([]);

export const { atom: swapTokenMapAtom, use: useSwapTokenMapAtom } =
  contextAtom<{
    updatedAt: number;
    tokenCatch?: Record<string, ISwapTokenCatch>;
  }>({
    updatedAt: 0,
  });

export const { atom: swapTokenFetchingAtom, use: useSwapTokenFetchingAtom } =
  contextAtom<boolean>(false);

// swap account
export const {
  atom: swapToAnotherAccountAddressAtom,
  use: useSwapToAnotherAccountAddressAtom,
} = contextAtom<{
  networkId: string | undefined;
  address: string | undefined;
  accountInfo: IAccountSelectorActiveAccountInfo | undefined;
}>({ networkId: undefined, address: undefined, accountInfo: undefined });

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
  atom: swapSelectedFromTokenBalanceAtom,
  use: useSwapSelectedFromTokenBalanceAtom,
} = contextAtom('0');

export const {
  atom: swapSelectedToTokenBalanceAtom,
  use: useSwapSelectedToTokenBalanceAtom,
} = contextAtom('0');

// swap quote
export const {
  atom: swapManualSelectQuoteProvidersAtom,
  use: useSwapManualSelectQuoteProvidersAtom,
} = contextAtom<IFetchQuoteResult | undefined>(undefined);

export const { atom: swapQuoteListAtom, use: useSwapQuoteListAtom } =
  contextAtom<IFetchQuoteResult[]>([]);

export const { atom: swapProviderSortAtom, use: useSwapProviderSortAtom } =
  contextAtom<ESwapProviderSort>(ESwapProviderSort.RECOMMENDED);

export const {
  atom: swapSortedQuoteListAtom,
  use: useSwapSortedQuoteListAtom,
} = contextAtomComputed<IFetchQuoteResult[]>((get) => {
  const list = get(swapQuoteListAtom());
  const sortType = get(swapProviderSortAtom());
  let sortedList = [...list];
  const gasFeeSorted = list.slice().sort((a, b) => {
    const aBig = new BigNumber(a.fee?.estimatedFeeFiatValue || Infinity);
    const bBig = new BigNumber(b.fee?.estimatedFeeFiatValue || Infinity);
    return aBig.comparedTo(bBig);
  });
  if (sortType === ESwapProviderSort.GAS_FEE) {
    sortedList = [...gasFeeSorted];
  }
  if (sortType === ESwapProviderSort.SWAP_DURATION) {
    sortedList = list.slice().sort((a, b) => {
      const aVal = new BigNumber(a.estimatedTime || Infinity);
      const bVal = new BigNumber(b.estimatedTime || Infinity);
      return aVal.comparedTo(bVal);
    });
  }
  const receivedSorted = list.slice().sort((a, b) => {
    const aVal = new BigNumber(a.toAmount || 0);
    const bVal = new BigNumber(b.toAmount || 0);
    if (aVal.isZero() || aVal.isNaN()) {
      return 1;
    }
    if (bVal.isZero() || bVal.isNaN()) {
      return -1;
    }
    return bVal.comparedTo(aVal);
  });
  if (
    sortType === ESwapProviderSort.RECOMMENDED ||
    sortType === ESwapProviderSort.RECEIVED
  ) {
    sortedList = [...receivedSorted];
  }
  return sortedList.map((p) => {
    if (p.info.provider === receivedSorted?.[0]?.info?.provider && p.toAmount) {
      p.receivedBest = true;
      p.isBest = true;
    }
    if (p.info.provider === gasFeeSorted?.[0]?.info?.provider && p.toAmount) {
      p.minGasCost = true;
    }
    return p;
  });
});

export const {
  atom: swapQuoteCurrentSelectAtom,
  use: useSwapQuoteCurrentSelectAtom,
} = contextAtomComputed((get) => {
  const list = get(swapSortedQuoteListAtom());
  const manualSelectQuoteProviders = get(swapManualSelectQuoteProvidersAtom());
  const manualSelectQuoteResult = list.find(
    (item) => item.info.provider === manualSelectQuoteProviders?.info.provider,
  );
  return manualSelectQuoteProviders && manualSelectQuoteResult?.toAmount
    ? list.find(
        (item) =>
          item.info.provider === manualSelectQuoteProviders.info.provider,
      )
    : list[0];
});

export const { atom: swapQuoteFetchingAtom, use: useSwapQuoteFetchingAtom } =
  contextAtom<boolean>(false);

export const {
  atom: swapSilenceQuoteLoading,
  use: useSwapSilenceQuoteLoading,
} = contextAtom<boolean>(false);

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

// swap state
export const { atom: swapAlertsAtom, use: useSwapAlertsAtom } = contextAtom<
  ISwapAlertState[]
>([]);

export const { atom: rateDifferenceAtom, use: useRateDifferenceAtom } =
  contextAtom<{ value: string; unit: ESwapRateDifferenceUnit } | undefined>(
    undefined,
  );

// swap approve
export const {
  atom: swapQuoteApproveAllowanceUnLimitAtom,
  use: useSwapQuoteApproveAllowanceUnLimitAtom,
} = contextAtom<boolean>(false);

export const {
  atom: swapApproveAllowanceSelectOpenAtom,
  use: useSwapApproveAllowanceSelectOpenAtom,
} = contextAtom<boolean>(false);

export const {
  atom: swapApprovingTransactionAtom,
  use: useSwapApprovingTransactionAtom,
} = contextAtom<ISwapApproveTransaction | undefined>(undefined);

// swap slippage
export const {
  atom: swapSlippagePercentageAtom,
  use: useSwapSlippagePercentageAtom,
} = contextAtom<ISwapSlippageSegmentItem>({
  key: ESwapSlippageSegmentKey.AUTO,
  value: 0.5,
});

export const {
  atom: swapSlippagePopoverOpeningAtom,
  use: useSwapSlippagePopoverOpeningAtom,
} = contextAtom<boolean>(false);

// swap build_tx
export const {
  atom: swapBuildTxFetchingAtom,
  use: useSwapBuildTxFetchingAtom,
} = contextAtom<boolean>(false);

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
} = contextAtomComputed<ISwapTxHistory[]>((get) => {
  const list = get(swapTxHistoryAtom());
  return list.filter((item) => item.status === ESwapTxHistoryStatus.PENDING);
});
