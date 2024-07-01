import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

import type { IDBWalletId } from '../../../dbs/local/types';
import type { IAccountDeriveTypes } from '../../../vaults/types';

export type IAccountIsAutoCreatingAtom =
  | {
      walletId: IDBWalletId | undefined;
      networkId: string | undefined;
      indexedAccountId: string | undefined;
      deriveType: IAccountDeriveTypes;
    }
  | undefined;
export type IAccountManualCreatingAtom = {
  isLoading: boolean;
};
export const {
  target: accountIsAutoCreatingAtom,
  use: useAccountIsAutoCreatingAtom,
} = globalAtom<IAccountIsAutoCreatingAtom>({
  name: EAtomNames.accountIsAutoCreatingAtom,
  initialValue: undefined,
});

export const {
  target: accountManualCreatingAtom,
  use: useAccountManualCreatingAtom,
} = globalAtom<IAccountManualCreatingAtom>({
  name: EAtomNames.accountManualCreatingAtom,
  initialValue: { isLoading: false },
});
