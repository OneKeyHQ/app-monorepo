import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import { usePrimeAuth } from './usePrimeAuth';

export function useFetchPrimeUserInfo() {
  const { isReady } = usePrimeAuth();
  const { result } = usePromiseResult(async () => {
    if (isReady) {
      const userInfo =
        await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
      return userInfo;
    }
    return undefined;
  }, [isReady]);

  return { result };
}
