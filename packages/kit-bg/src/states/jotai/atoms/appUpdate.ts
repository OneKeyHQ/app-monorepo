import {
  EAppUpdateStatus,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export const { target: appUpdatePersistAtom, use: useAppUpdatePersistAtom } =
  globalAtom<IAppUpdateInfo>({
    persist: true,
    name: EAtomNames.appUpdatePersistAtom,
    initialValue: {
      latestVersion: '0.0.0',
      updateAt: 0,
      status: EAppUpdateStatus.done,
      updateStrategy: EUpdateStrategy.manual,
      lastUpdateDialogShownAt: undefined,
    },
  });
