import {
  ImportBackupPasswordModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import type { RestoreResult } from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.enums';

import useAppNavigation from './useAppNavigation';

export default function useImportBackupPasswordModal() {
  const navigation = useAppNavigation();

  const requestBackupPassword = (
    withPassword: (backupPassword: string) => Promise<RestoreResult>,
    onSuccess: () => Promise<void>,
    onError: () => void,
    onCancel?: () => void,
  ) => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.ImportBackupPassword,
      params: {
        screen: ImportBackupPasswordModalRoutes.ImportBackupPassword,
        params: {
          withPassword,
          onSuccess,
          onError,
          onCancel,
        },
      },
    });
  };

  return { requestBackupPassword };
}
