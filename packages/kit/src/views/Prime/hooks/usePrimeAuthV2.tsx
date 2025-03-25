import { useCallback, useMemo } from 'react';

import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { usePrivyUniversalV2 } from './usePrivyUniversalV2';

export function usePrimeAuthV2() {
  const [user] = usePrimePersistAtom();

  const {
    logout: sdkLogout,
    getAccessToken,
    isReady,
    authenticated,
    useLoginWithEmail,
    privyUser,
  } = usePrivyUniversalV2();

  const apiLogout = useCallback(async () => {
    await backgroundApiProxy.servicePrime.apiLogout();
  }, []);

  const logout: () => Promise<void> = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      await sdkLogout();
    }
  }, [apiLogout, sdkLogout]);

  const saveAccessToken = useCallback(async () => {
    if (authenticated) {
      const accessToken = await getAccessToken();
      if (accessToken) {
        await backgroundApiProxy.simpleDb.prime.saveAuthToken(accessToken);
      }
    }
  }, [authenticated, getAccessToken]);

  return useMemo(() => {
    return {
      isLoggedIn: user?.isLoggedIn,
      isPrimeSubscriptionActive: user?.primeSubscription?.isActive,
      user,
      logout,
      apiLogout,
      sdkLogout,
      getAccessToken,
      saveAccessToken,
      isReady,
      authenticated,
      useLoginWithEmail,
      privyUser,
    };
  }, [
    authenticated,
    getAccessToken,
    saveAccessToken,
    isReady,
    logout,
    apiLogout,
    sdkLogout,
    privyUser,
    useLoginWithEmail,
    user,
  ]);
}
