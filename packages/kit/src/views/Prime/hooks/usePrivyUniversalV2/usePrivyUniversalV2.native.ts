import { useLoginWithEmail, usePrivy } from '@privy-io/expo';

import type { IUsePrivyUniversalV2 } from './usePrivyUniversalV2Types';

export function usePrivyUniversalV2(): IUsePrivyUniversalV2 {
  const { logout, isReady, getAccessToken, user } = usePrivy();
  const authenticated = !!user;

  return {
    useLoginWithEmail: (...args) => {
      const { sendCode, loginWithCode } = useLoginWithEmail(...args);

      return {
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
    user: authenticated
      ? {
          id: user?.id || '',
        }
      : undefined,
  };
}
