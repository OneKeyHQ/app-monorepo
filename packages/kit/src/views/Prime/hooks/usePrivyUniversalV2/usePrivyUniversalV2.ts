import { useLoginWithEmail, usePrivy } from '@privy-io/react-auth';

import type { IUsePrivyUniversalV2 } from './usePrivyUniversalV2Types';

export function usePrivyUniversalV2(): IUsePrivyUniversalV2 {
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { logout, ready, getAccessToken, authenticated } = usePrivy();

  return {
    sendCode,
    loginWithCode,
    logout,
    isReady: ready,
    getAccessToken,
    authenticated,
  };
}
