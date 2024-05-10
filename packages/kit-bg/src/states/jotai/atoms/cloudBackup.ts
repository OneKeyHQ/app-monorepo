import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type ICloudBackupPersistAtom = {
  isEnabled: boolean;
  isInProgress: boolean;
  isFirstEnabled: boolean;
  isFirstDisabled: boolean;
};
export const {
  target: cloudBackupPersistAtom,
  use: useCloudBackupPersistAtom,
} = globalAtom<ICloudBackupPersistAtom>({
  persist: true,
  name: EAtomNames.cloudBackupPersistAtom,
  initialValue: {
    isEnabled: false,
    isInProgress: false,
    isFirstEnabled: true,
    isFirstDisabled: true,
  },
});
