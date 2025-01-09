import { useMemo } from 'react';

import { usePrivy, useLogin as usePrivyLogin } from '@privy-io/react-auth';

import type { IUsePrivyUniversal } from './usePrivyUniversalTypes';

export function usePrivyUniversal(): IUsePrivyUniversal {
  const privy = usePrivy();
  // https://github.com/privy-io/create-next-app/blob/main/pages/index.tsx
  const {
    ready,
    authenticated,
    user,
    logout,
    updateEmail: updateEmailWeb,
    updatePhone: updatePhoneWeb,
    linkEmail,
    linkWallet,
    unlinkEmail,
    linkPhone,
    unlinkPhone,
    unlinkWallet,
    linkGoogle,
    unlinkGoogle,
    linkTwitter,
    unlinkTwitter,
    linkDiscord,
    unlinkDiscord,
    getAccessToken,
  } = privy;
  const { login: loginWeb } = usePrivyLogin({
    onComplete(
      user0,
      isNewUser,
      wasAlreadyAuthenticated,
      loginMethod,
      loginAccount,
    ) {
      console.log('privy login complete >>> ', {
        user0,
        isNewUser,
        wasAlreadyAuthenticated,
        loginMethod,
        loginAccount,
      });
    },
  });

  return useMemo<IUsePrivyUniversal>(
    () => ({
      //   privy,
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
