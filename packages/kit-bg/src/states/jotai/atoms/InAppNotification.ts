import type {
  IFetchLimitOrderRes,
  ISwapApproveTransaction,
  ISwapToken,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IInAppNotificationAtom = {
  swapHistoryPendingList: ISwapTxHistory[];
  swapLimitOrders: IFetchLimitOrderRes[];
  swapLimitOrdersLoading: boolean;
  swapApprovingTransaction: ISwapApproveTransaction | undefined;
  swapRecentTokenPairs: { fromToken: ISwapToken; toToken: ISwapToken }[];
};
export const { target: inAppNotificationAtom, use: useInAppNotificationAtom } =
  globalAtom<IInAppNotificationAtom>({
    persist: false,
    name: EAtomNames.inAppNotificationAtom,
    initialValue: {
      swapHistoryPendingList: [],
      swapLimitOrders: [],
      swapLimitOrdersLoading: false,
      swapApprovingTransaction: undefined,
      swapRecentTokenPairs: [],
    },
  });
