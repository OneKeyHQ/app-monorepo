import type {
  ISwapApproveTransaction,
  ISwapToken,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IInAppNotificationAtom = {
  swapHistoryPendingList: ISwapTxHistory[];
  swapApprovingTransaction: ISwapApproveTransaction | undefined;
  swapRecentTokenPairs: { fromToken: ISwapToken; toToken: ISwapToken }[];
};
export const { target: inAppNotificationAtom, use: useInAppNotificationAtom } =
  globalAtom<IInAppNotificationAtom>({
    persist: false,
    name: EAtomNames.inAppNotificationAtom,
    initialValue: {
      swapHistoryPendingList: [],
      swapApprovingTransaction: undefined,
      swapRecentTokenPairs: [],
    },
  });
