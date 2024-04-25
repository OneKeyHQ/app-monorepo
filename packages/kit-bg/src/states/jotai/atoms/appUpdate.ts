import {
  EAppUpdateStatus,
  type IAppUpdateInfo,
} from '@onekeyhq/shared/src/appUpdate';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export const { target: appUpdatePersistAtom, use: useAppUpdatePersistAtom } =
  globalAtom<IAppUpdateInfo>({
    persist: true,
    name: EAtomNames.appUpdatePersistAtom,
    initialValue: {
      latestVersion: '0.0.0',
      isForceUpdate: false,
      updateAt: 0,
      sha256: '',
      status: EAppUpdateStatus.done,
    },
  });
