import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IV4MigrationAtom = {
  progress: number;
  backedUpMark: Partial<Record<string, boolean>>;
  isProcessing: boolean;
  isMigrationModalOpen?: boolean;
};
export const { target: v4migrationAtom, use: useV4migrationAtom } =
  globalAtom<IV4MigrationAtom>({
    persist: false,
    name: EAtomNames.v4migrationAtom,
    initialValue: {
      progress: 0,
      backedUpMark: {},
      isProcessing: false,
      isMigrationModalOpen: false,
    },
  });

export type IV4MigrationPersistAtom = {
  v4migrationAutoStartDisabled: boolean;
  v4migrationAutoStartCount: number;
  downgradeWarningConfirmed: boolean;
};
export const {
  target: v4migrationPersistAtom,
  use: useV4migrationPersistAtom,
} = globalAtom<IV4MigrationPersistAtom>({
  persist: true,
  name: EAtomNames.v4migrationPersistAtom,
  initialValue: {
    v4migrationAutoStartDisabled: false,
    v4migrationAutoStartCount: 0,
    downgradeWarningConfirmed: false,
  },
});
