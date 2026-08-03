import { useMemo } from 'react';

import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import {
  type IFetchedNetworkLogo,
  resolveNetworkLogoUri,
} from './useNetworkLogoUri.utils';
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
    async (): Promise<IFetchedNetworkLogo> => {
      if (!shouldFetch || !networkId) {
        return { logoUri: '' };
      }
      return {
        logoUri: await fetchNetworkLogo(networkId),
        networkId,
      };
    },
    [shouldFetch, networkId],
    {
      checkIsFocused: false,
      initResult: { logoUri: '' },
    },
  );

  // A result fetched for the previous network must never be shown beside the
  // new network identity while its request is still pending.
  return useMemo(
    () => resolveNetworkLogoUri({ fetchedLogo, logoUri, networkId }),
    [fetchedLogo, logoUri, networkId],
  );
}
