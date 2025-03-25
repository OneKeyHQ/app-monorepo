import { useCallback } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { usePrimeAuthV2 } from './usePrimeAuthV2';

export function useFetchPrimeUserInfo() {
  const { isReady, user, saveAccessToken } = usePrimeAuthV2();
  const fetchPrimeUserInfo = useCallback(async () => {
    // should save access token before fetching user info
    await saveAccessToken();

    if (isReady && user?.privyUserId) {
      const userInfo =
        await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
      return userInfo;
    }
    return undefined;
  }, [isReady, user?.privyUserId, saveAccessToken]);

  return { fetchPrimeUserInfo };
}
