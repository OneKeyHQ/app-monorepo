import { useMemo } from 'react';

import { usePrivy, useLogin as usePrivyLogin } from '@privy-io/react-auth';

import type { IUsePrivyUniversal } from './usePrivyUniversalTypes';

export function usePrivyUniversal(): IUsePrivyUniversal {
  const privy = usePrivy();
  const {
    logout,
    updateEmail: updateEmailWeb,
    updatePhone: updatePhoneWeb,
    getAccessToken,
  } = privy;
  const { login: loginWeb } = usePrivyLogin({
    onComplete(...args) {
      console.log('privy login complete >>> ', args);
    },
  });

  return useMemo<IUsePrivyUniversal>(
    () => ({
      native: undefined,
      web: {
        user: privy.user,
        login: loginWeb,
        updateEmail: updateEmailWeb,
        updatePhone: updatePhoneWeb,
      },
      authenticated: privy.authenticated,
      userEmail: privy.user?.email?.address,
      privyUserId: privy.user?.id,
      isReady: privy.ready,
      logout,
      getAccessToken,
    }),
    [
      getAccessToken,
      loginWeb,
      logout,
      privy.authenticated,
      privy.ready,
      privy.user,
      updateEmailWeb,
      updatePhoneWeb,
    ],
  );
}
