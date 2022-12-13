import { ImportBackupPasswordRoutes } from '@onekeyhq/kit/src/routes/Modal/ImportBackupPassword';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

import useAppNavigation from './useAppNavigation';

import type { RestoreResult } from '../../../kit-bg/src/services/ServiceCloudBackup.types';

export default function useImportBackupPasswordModal() {
  const navigation = useAppNavigation();

  const requestBackupPassword = (
    withPassword: (backupPassword: string) => Promise<RestoreResult>,
    onSuccess: () => Promise<void>,
    onError: () => void,
  ) => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.ImportBackupPassword,
      params: {
        screen: ImportBackupPasswordRoutes.ImportBackupPassword,
        params: {
          withPassword,
          onSuccess,
          onError,
        },
      },
    });
  };

  return { requestBackupPassword };
}
