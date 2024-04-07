import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export interface IAppUpdatePersistAtom {
  // current version
  version: string;
  // the latest version of remote server
  latestVersion: string;
  // is force update required
  isForceUpdate: boolean;
  // change log text
  changeLog?: string;
}

export const { target: appUpdatePersistAtom, use: useAppUpdatePersistAtom } =
  globalAtom<IAppUpdatePersistAtom>({
    persist: true,
    name: EAtomNames.appUpdateAtom,
    initialValue: {
      version: process.env.VERSION ?? '1.0.0',
      latestVersion: process.env.VERSION ?? '1.0.0',
      isForceUpdate: false,
      changeLog: '',
    },
  });
