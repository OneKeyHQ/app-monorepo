import { useCallback } from 'react';

import { useIdentityExitFlow } from './useIdentityExitFlow';

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
  const { run } = useIdentityExitFlow();

  return useCallback(() => {
    void run(
      { type: 'logoutOneKeyId', scene: 'profile' },
      {
        analyticsReason: reason,
        beforeExecute: onBeforeLogout,
        onCompletedReceipt: onSuccess,
      },
    );
  }, [onBeforeLogout, onSuccess, reason, run]);
}
