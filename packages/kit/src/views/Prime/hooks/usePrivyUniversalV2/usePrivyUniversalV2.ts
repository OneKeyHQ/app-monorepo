import { useLoginWithEmail, usePrivy } from '@privy-io/react-auth';

import type { IUsePrivyUniversalV2 } from './usePrivyUniversalV2Types';

export function usePrivyUniversalV2(): IUsePrivyUniversalV2 {
  const { logout, ready, getAccessToken, authenticated, user } = usePrivy();

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
    user: authenticated
      ? {
          id: user?.id || '',
          email: user?.email?.address || '',
        }
      : undefined,
  };
}
