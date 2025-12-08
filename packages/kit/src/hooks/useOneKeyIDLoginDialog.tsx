import { useCallback, useMemo } from 'react';

import { showOneKeyIDLoginDialog } from '../views/Prime/components/OneKeyIDLoginDialog';

export interface IUseOneKeyIDLoginDialogOptions {
  onLoginSuccess?: () => void | Promise<void>;
}

export function useOneKeyIDLoginDialog(
  options: IUseOneKeyIDLoginDialogOptions = {},
) {
  const { onLoginSuccess } = options;

  const showLoginDialog = useCallback(() => {
    return showOneKeyIDLoginDialog({
      onLoginSuccess,
    });
  }, [onLoginSuccess]);

  return useMemo(
    () => ({
      showLoginDialog,
    }),
    [showLoginDialog],
  );
}
