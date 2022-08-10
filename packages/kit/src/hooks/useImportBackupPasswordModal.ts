import { ImportBackupPasswordRoutes } from '@onekeyhq/kit/src/routes/Modal/ImportBackupPassword';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

import useAppNavigation from './useAppNavigation';

export default function useImportBackupPasswordModal() {
  const navigation = useAppNavigation();

  const requestBackupPassword = (
    onSuccess: (backupPassword: string) => void,
    onCancel: () => void,
  ) => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.ImportBackupPassword,
      params: {
        screen: ImportBackupPasswordRoutes.ImportBackupPassword,
        params: {
          onSuccess,
          onCancel,
        },
      },
    });
  };

  return { requestBackupPassword };
}
