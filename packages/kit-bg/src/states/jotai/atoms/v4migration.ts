import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IV4MigrationAtom = {
  progress: number;
  backedUpMark: Partial<Record<string, boolean>>;
};
export const { target: v4migrationAtom, use: useV4migrationAtom } =
  globalAtom<IV4MigrationAtom>({
    persist: false,
    name: EAtomNames.v4migrationAtom,
    initialValue: {
      progress: 0,
      backedUpMark: {},
    },
  });
