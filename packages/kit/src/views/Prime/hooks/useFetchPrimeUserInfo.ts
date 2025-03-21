import { useCallback } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { usePrimeAuthV2 } from './usePrimeAuthV2';

export function useFetchPrimeUserInfo() {
  const { isReady, user } = usePrimeAuthV2();
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
