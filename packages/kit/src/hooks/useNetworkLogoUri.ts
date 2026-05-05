import { useMemo } from 'react';

import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { usePromiseResult } from './usePromiseResult';

// Memoized async function - handles both caching and concurrent request deduplication
const fetchNetworkLogo = memoizee(
  async (networkId: string): Promise<string> => {
    try {
      const network = await backgroundApiProxy.serviceNetwork.getNetworkSafe({
        networkId,
      });
      return network?.logoURI || '';
    } catch {
      return '';
    }
  },
  {
    promise: true,
    maxAge: timerUtils.getTimeDurationMs({ hour: 24 }),
  },
);

/**
 * Hook to get network logo URI with async fallback.
 * If logoUri is provided, returns it directly.
 * If logoUri is empty but networkId exists, fetches the network info asynchronously.
 * Fetched logos are cached to avoid repeated API calls.
 */
export function useNetworkLogoUri({
  logoUri,
  networkId,
}: {
  logoUri?: string;
  networkId?: string;
}): string {
  const shouldFetch = !logoUri && !!networkId;

  const { result: fetchedLogo } = usePromiseResult(
    () =>
      shouldFetch && networkId
        ? fetchNetworkLogo(networkId)
        : Promise.resolve(''),
    [shouldFetch, networkId],
    {
      checkIsFocused: false,
    },
  );

  // useMemo to avoid unnecessary re-renders
  return useMemo(() => logoUri || fetchedLogo || '', [logoUri, fetchedLogo]);
}
