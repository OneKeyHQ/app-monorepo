import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type ICloudBackupPersistAtom = {
  isEnabled: boolean;
  isInProgress: boolean;
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
  },
});
