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
