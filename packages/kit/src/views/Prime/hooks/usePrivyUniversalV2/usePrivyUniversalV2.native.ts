import { useMemo } from 'react';

import { useLoginWithEmail, usePrivy } from '@privy-io/expo';

export function usePrivyUniversalV2() {
  const { logout, isReady, getAccessToken, user } = usePrivy();
  const authenticated = !!user;

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

  return useMemo(() => {
    return {
      useLoginWithEmail: (args) => {
        const { onComplete, onError } = args || {};
        const { sendCode, loginWithCode, state } = useLoginWithEmail({
          onLoginSuccess: () => {
            onComplete?.();
          },
          onError,
        });

        return {
          state,
          sendCode: async (...sendCodeArgs) => {
            await sendCode(...sendCodeArgs);
          },
          loginWithCode: async (...loginWithCodeArgs) => {
            await loginWithCode(...loginWithCodeArgs);
          },
        };
      },
      logout,
      isReady,
      getAccessToken,
      authenticated,
      privyUser: authenticated
        ? {
            id: user?.id || '',
            email: userEmail || '',
          }
        : undefined,
    };
  }, [authenticated, getAccessToken, isReady, logout, user?.id, userEmail]);
}
