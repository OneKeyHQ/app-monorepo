// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { useAtomValue, useSetAtom } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { isEqual } from 'lodash';

import type { ISwapProviderManager } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IFetchLimitOrderRes,
  ISwapApproveTransaction,
  ISwapToken,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IInAppNotificationAtom = {
  // May contain null/undefined entries due to data corruption or deserialization issues
  swapHistoryPendingList: (ISwapTxHistory | null | undefined)[];
  swapLimitOrders: IFetchLimitOrderRes[];
  swapLimitOrdersLoading: boolean;
  swapLimitOrdersAccountIdKey?: string;
  swapApprovingTransaction: ISwapApproveTransaction | undefined;
  speedSwapApprovingTransaction: ISwapApproveTransaction | undefined;
  speedSwapApprovingLoading: boolean;
  swapRecentTokenPairs: { fromToken: ISwapToken; toToken: ISwapToken }[];
  swapPercentageInputStageShowForNative: boolean;
  swapProviderManager: ISwapProviderManager[];
  bridgeProviderManager: ISwapProviderManager[];
  swapApprovingLoading: boolean;
};
// Filters out null/undefined entries that may exist in swapHistoryPendingList.
// Always use this before accessing item properties to prevent runtime crashes.
export function filterSwapHistoryPendingList(
  list: (ISwapTxHistory | null | undefined)[],
): ISwapTxHistory[] {
  return list.filter((i): i is ISwapTxHistory => !!i);
}

export const { target: inAppNotificationAtom, use: useInAppNotificationAtom } =
  globalAtom<IInAppNotificationAtom>({
    persist: false,
    name: EAtomNames.inAppNotificationAtom,
    initialValue: {
      swapHistoryPendingList: [],
      swapLimitOrders: [],
      swapLimitOrdersLoading: false,
      swapLimitOrdersAccountIdKey: undefined,
      swapApprovingTransaction: undefined,
      speedSwapApprovingTransaction: undefined,
      swapRecentTokenPairs: [],
      swapPercentageInputStageShowForNative: false,
      swapProviderManager: [],
      bridgeProviderManager: [],
      swapApprovingLoading: false,
      speedSwapApprovingLoading: false,
    },
  });

// The atom is one object that every writer replaces as a whole, and on split
// runtimes each push from the background deserializes into new identities. A
// component reading one field through `useInAppNotificationAtom` therefore
// re-renders on a write to any other field, and one that only writes
// re-renders on every write. The Swap tab stays mounted while hidden, so that
// is its whole tree, three times per account switch on Home (the limit-order
// loop). These subscribe to a slice by value, or to nothing.
function createInAppNotificationSliceHook<T>(
  select: (state: IInAppNotificationAtom) => T,
) {
  let sliceAtom: ReturnType<typeof selectAtom<IInAppNotificationAtom, T>>;
  return () => {
    sliceAtom =
      sliceAtom ?? selectAtom(inAppNotificationAtom.atom(), select, isEqual);
    return useAtomValue(sliceAtom);
  };
}

export const useInAppNotificationSwapRecentTokenPairs =
  createInAppNotificationSliceHook((state) => state.swapRecentTokenPairs);

export const useInAppNotificationSwapHistoryPendingList =
  createInAppNotificationSliceHook((state) => state.swapHistoryPendingList);

export const useInAppNotificationSwapApproving =
  createInAppNotificationSliceHook((state) => ({
    swapApprovingLoading: state.swapApprovingLoading,
    swapApprovingTransaction: state.swapApprovingTransaction,
  }));

export const useInAppNotificationSwapOrders = createInAppNotificationSliceHook(
  (state) => ({
    swapHistoryPendingList: state.swapHistoryPendingList,
    swapLimitOrders: state.swapLimitOrders,
    swapLimitOrdersAccountIdKey: state.swapLimitOrdersAccountIdKey,
  }),
);

export const useInAppNotificationSwapPercentageInputStageShowForNative =
  createInAppNotificationSliceHook(
    (state) => state.swapPercentageInputStageShowForNative,
  );

export const useSetInAppNotificationAtom = () =>
  useSetAtom(inAppNotificationAtom.atom());
