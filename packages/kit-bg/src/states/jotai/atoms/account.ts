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
export const {
  target: accountIsAutoCreatingAtom,
  use: useAccountIsAutoCreatingAtom,
} = globalAtom<IAccountIsAutoCreatingAtom>({
  name: EAtomNames.accountIsAutoCreatingAtom,
  initialValue: undefined,
});
