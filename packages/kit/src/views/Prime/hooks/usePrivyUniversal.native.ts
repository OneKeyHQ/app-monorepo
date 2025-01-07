import { useMemo } from 'react';

import { usePrivy, useLogin as usePrivyLogin } from '@privy-io/expo';

import type { IUsePrivyUniversal } from './usePrivyUniversalTypes';

export function usePrivyUniversal(): IUsePrivyUniversal {
  const privy = usePrivy();
  const { error, user, isReady, logout, getAccessToken } = privy;
  const { login } = usePrivyLogin();

  console.log('usePrivyUniversal: isReady >>>>> ', isReady);

  const userEmail = useMemo<string | undefined>(() => {
    if (user) {
      const emailUser = user?.linked_accounts?.find(
        (item) => item.type === 'email',
      );
      if (emailUser) {
        const address: string = (emailUser as { address: string }).address;
        return address;
      }
    }
    return undefined;
  }, [user]);

  return useMemo<IUsePrivyUniversal>(
    () => ({
      //   privy,
      web: undefined,
      native: {
        login,
        error,
        user,
      },
      authenticated: !!user,
      userEmail,
      privyUserId: user?.id,
      isReady,
      logout,
      getAccessToken,
    }),
    [getAccessToken, login, logout, user, error, isReady, userEmail],
  );
}
