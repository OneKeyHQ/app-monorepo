import { useCallback } from 'react';

import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { usePrivyUniversalV2 } from './usePrivyUniversalV2';

export function usePrimeAuthV2() {
  const [user] = usePrimePersistAtom();

  const { logout, getAccessToken, isReady, authenticated } =
    usePrivyUniversalV2();
  const logoutWithApi: () => Promise<void> = useCallback(async () => {
    try {
      await backgroundApiProxy.servicePrime.apiLogout();
    } finally {
      await logout();
    }
  }, [logout]);

  return {
    isLoggedIn: user?.isLoggedIn,
    isPrimeSubscriptionActive: user?.primeSubscription?.isActive,
    user,
    logout: logoutWithApi,
    getAccessToken,
    isReady,
    authenticated,
  };
}
