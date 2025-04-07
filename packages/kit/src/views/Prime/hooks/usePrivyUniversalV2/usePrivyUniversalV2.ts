import { useMemo } from 'react';

import { useLoginWithEmail, usePrivy } from '@privy-io/react-auth';

import type { IUsePrivyUniversalV2 } from './usePrivyUniversalV2Types';

// usePrivyUniversalV2
export function usePrivyUniversalV2(): IUsePrivyUniversalV2 {
  const { logout, ready, getAccessToken, authenticated, user } = usePrivy();

  return useMemo(() => {
    return {
      useLoginWithEmail: (args) => {
        const { onComplete, onError } = args || {};
        const { sendCode, loginWithCode, state } = useLoginWithEmail({
          onComplete,
          onError: (error) => {
            onError?.(error);
          },
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
      isReady: ready,
      getAccessToken,
      authenticated,
      privyUser: authenticated
        ? {
            id: user?.id || '',
            email: user?.email?.address || '',
          }
        : undefined,
    };
  }, [
    authenticated,
    getAccessToken,
    logout,
    ready,
    user?.email?.address,
    user?.id,
  ]);
}
