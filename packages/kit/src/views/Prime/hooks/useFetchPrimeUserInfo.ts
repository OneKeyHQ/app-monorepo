import { useCallback } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { usePrivyUniversalV2 } from './usePrivyUniversalV2';

export function useFetchPrimeUserInfo() {
  const { isReady, user } = usePrivyUniversalV2();
  const fetchPrimeUserInfo = useCallback(async () => {
    if (isReady && user?.id) {
      const userInfo =
        await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
      return userInfo;
    }
    return undefined;
  }, [isReady, user?.id]);

  return { fetchPrimeUserInfo };
}
