import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IKeylessPinConfirmStatusAtomData = {
  socialUserIdHash: string | undefined;
  socialProvider: string | undefined;
  needRemind: boolean | undefined;
  remindTime: number | undefined;
  confirmedCount: number | undefined;
} | null;

export const {
  target: keylessPinConfirmStatusAtom,
  use: useKeylessPinConfirmStatusAtom,
} = globalAtom<IKeylessPinConfirmStatusAtomData>({
  name: EAtomNames.keylessPinConfirmStatusAtom,
  initialValue: null,
});

// last cancel verify pin time atom
export const {
  target: keylessLastCancelVerifyPinTimeAtom,
  use: useKeylessLastCancelVerifyPinTimeAtom,
} = globalAtom<number | undefined>({
  persist: true,
  name: EAtomNames.keylessLastCancelVerifyPinTimeAtom,
  initialValue: undefined,
});

export type IKeylessBackendShareV2MigrationPersistAtomData = {
  byWalletId: Record<
    string,
    {
      ownerId?: string;
      keylessProvider?: string;
      socialUserIdHash?: string;
      lastPassiveAttemptAt?: number;
      lastPassiveFailedAt?: number;
      succeededAt?: number;
    }
  >;
};

export const {
  target: keylessBackendShareV2MigrationPersistAtom,
  use: useKeylessBackendShareV2MigrationPersistAtom,
} = globalAtom<IKeylessBackendShareV2MigrationPersistAtomData>({
  persist: true,
  name: EAtomNames.keylessBackendShareV2MigrationPersistAtom,
  initialValue: {
    byWalletId: {},
  },
});
