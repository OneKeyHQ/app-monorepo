import { useCallback, useMemo } from 'react';

import { useOneKeyAuth } from '../OneKeyAuth/useOneKeyAuth';

export function useKeylessWallet() {
  const { isLoggedIn, loginOneKeyId, user } = useOneKeyAuth();

  const isKeylessWalletCreated = useMemo(() => {
    return !!user?.keylessWalletId;
  }, [user]);

  const createKeylessWalletFn = useCallback(async () => {
    
  }, []);

  const enableKeylessWalletFn = useCallback(async () => {
    if (!isKeylessWalletCreated) {
      await createKeylessWalletFn();
    }
    // TODO @franco enable keyless wallet
  }, []);

  const enableKeylessWallet = useCallback(async () => {
    // check if the user is logged in
    if (!isLoggedIn) {
      await loginOneKeyId({
        onLoginSuccess: async () => {
          await enableKeylessWalletFn();
        },
      });
      return;
    }
    await enableKeylessWalletFn();
  }, [enableKeylessWalletFn, isLoggedIn, loginOneKeyId]);

  return {
    enableKeylessWallet,
  };
}
