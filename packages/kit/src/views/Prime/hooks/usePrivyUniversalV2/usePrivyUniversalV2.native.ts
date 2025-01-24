import { useLoginWithEmail, usePrivy } from '@privy-io/expo';

import type { IUsePrivyUniversalV2 } from './usePrivyUniversalV2Types';

export function usePrivyUniversalV2(): IUsePrivyUniversalV2 {
  const { logout, isReady, getAccessToken, user } = usePrivy();
  const authenticated = !!user;

  return {
    useLoginWithEmail,
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
