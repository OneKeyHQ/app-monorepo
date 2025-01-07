import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import { usePrimeAuth } from './usePrimeAuth';

export function useFetchPrimeUserInfo() {
  const { isReady, user } = usePrimeAuth();
  const { result } = usePromiseResult(async () => {
    if (isReady && user?.privyUserId) {
      const userInfo =
        await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
      return userInfo;
    }
    return undefined;
  }, [isReady, user?.privyUserId]);

  return { result };
}
