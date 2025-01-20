import { useCallback } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { usePrimeAuth } from './usePrimeAuth';

export function useFetchPrimeUserInfo() {
  const { isReady, user } = usePrimeAuth();
  const fetchPrimeUserInfo = useCallback(async () => {
    if (isReady && user?.privyUserId) {
      const userInfo =
        await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
      return userInfo;
    }
    return undefined;
  }, [isReady, user?.privyUserId]);

  return { fetchPrimeUserInfo };
}
