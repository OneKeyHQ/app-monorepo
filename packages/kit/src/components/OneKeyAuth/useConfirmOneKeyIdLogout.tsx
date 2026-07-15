import { useCallback } from 'react';

import {
  EOneKeyIdLogoutDialogSource,
  useShowOneKeyIdLogoutDialog,
} from './OneKeyIdLogoutDialog';

type IUseConfirmOneKeyIdLogoutOptions = {
  reason: string;
  onBeforeLogout?: () => void | Promise<void>;
  onSuccess?: () => void | Promise<void>;
};

export function useConfirmOneKeyIdLogout({
  reason,
  onBeforeLogout,
  onSuccess,
}: IUseConfirmOneKeyIdLogoutOptions) {
  const showOneKeyIdLogoutDialog = useShowOneKeyIdLogoutDialog();

  return useCallback(() => {
    void showOneKeyIdLogoutDialog({
      source: EOneKeyIdLogoutDialogSource.OneKeyId,
      reason,
      onBeforeLogout,
      onSuccess,
    });
  }, [onBeforeLogout, onSuccess, reason, showOneKeyIdLogoutDialog]);
}
