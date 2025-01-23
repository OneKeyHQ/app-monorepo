import { useLoginWithEmail, usePrivy } from '@privy-io/expo';

import type { IUsePrivyUniversalV2 } from './usePrivyUniversalV2Types';

export function usePrivyUniversalV2(): IUsePrivyUniversalV2 {
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { logout, isReady, getAccessToken, user } = usePrivy();

  return {
    logout,
    isReady,
    getAccessToken,
    sendCode: async (args) => {
      await sendCode(args);
    },
    loginWithCode: async (args) => {
      await loginWithCode(args);
    },
    authenticated: !!user,
  };
}
