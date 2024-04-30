import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IStatusNotificationAtom = {
  swapHistoryPendingList: ISwapTxHistory[];
};
export const {
  target: statusNotificationAtom,
  use: useStatusNotificationAtom,
} = globalAtom<IStatusNotificationAtom>({
  persist: false,
  name: EAtomNames.statusNotificationAtom,
  initialValue: {
    swapHistoryPendingList: [],
  },
});
