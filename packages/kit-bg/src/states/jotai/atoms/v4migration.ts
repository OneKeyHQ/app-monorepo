import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IV4MigrationAtom = {
  progress: number;
  backedUpMark: Partial<Record<string, boolean>>;
  isProcessing: boolean;
};
export const { target: v4migrationAtom, use: useV4migrationAtom } =
  globalAtom<IV4MigrationAtom>({
    persist: false,
    name: EAtomNames.v4migrationAtom,
    initialValue: {
      progress: 0,
      backedUpMark: {},
      isProcessing: false,
    },
  });

export type IV4MigrationPersistAtom = {
  v4migrationAutoStartDisabled: boolean;
  v4migrationAutoStartCount: number;
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
  },
});
