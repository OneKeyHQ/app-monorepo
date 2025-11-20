import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

import type { IBackupProviderInfo } from '../../../services/ServiceCloudBackupV2/backupProviders/IOneKeyBackupProvider';

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

export type ICloudBackupStatusAtom = {
  supportCloudBackup: boolean;
  cloudBackupProviderName: string;
  cloudBackupProviderIcon: string;
  cloudBackupProviderInfo: IBackupProviderInfo | undefined;
};
export const { target: cloudBackupStatusAtom, use: useCloudBackupStatusAtom } =
  globalAtom<ICloudBackupStatusAtom>({
    name: EAtomNames.cloudBackupStatusAtom,
    initialValue: {
      supportCloudBackup: false,
      cloudBackupProviderName: 'CloudDrive',
      cloudBackupProviderIcon: 'CloudOutline',
      cloudBackupProviderInfo: undefined,
    },
  });

export type ICloudBackupExitPreventAtom = {
  shouldPreventExit: boolean;
};
export const {
  target: cloudBackupExitPreventAtom,
  use: useCloudBackupExitPreventAtom,
} = globalAtom<ICloudBackupExitPreventAtom>({
  name: EAtomNames.cloudBackupExitPreventAtom,
  initialValue: {
    shouldPreventExit: false,
  },
});
