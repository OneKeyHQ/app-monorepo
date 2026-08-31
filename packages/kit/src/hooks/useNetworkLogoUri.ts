import { useEffect, useMemo, useState } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import {
  type IFetchedNetworkLogo,
  deleteCachedNetworkLogoUri,
  getCachedNetworkLogoUri,
  resolveNetworkLogoUri,
  setCachedNetworkLogoUri,
} from './useNetworkLogoUri.utils';
import { usePromiseResult } from './usePromiseResult';

const fetchNetworkLogo = memoizee(
  async (networkId: string): Promise<string> => {
    try {
      const network = await backgroundApiProxy.serviceNetwork.getNetworkSafe({
        networkId,
      });
      const logoUri = network?.logoURI || '';
      setCachedNetworkLogoUri({ logoUri, networkId });
      return logoUri;
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
 * Otherwise, resolves built-in networks synchronously and only fetches unknown
 * network info asynchronously.
 * Fetched logos are cached to avoid repeated API calls.
 */
export function useNetworkLogoUri({
  logoUri,
  networkId,
}: {
  logoUri?: string;
  networkId?: string;
}): string {
  const [, setCacheRevision] = useState(0);
  const localLogoUri = useMemo(
    () =>
      networkId
        ? networkUtils.getLocalNetworkInfo(networkId)?.logoURI
        : undefined,
    [networkId],
  );
  const ownedLogoUri = logoUri || localLogoUri;
  const cachedLogoUri = getCachedNetworkLogoUri(networkId);
  const shouldFetch = !ownedLogoUri && !!networkId;

  useEffect(() => {
    setCachedNetworkLogoUri({ logoUri: ownedLogoUri, networkId });
  }, [networkId, ownedLogoUri]);

  const { result: fetchedLogo, run } = usePromiseResult(
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
      initResult: {
        logoUri: cachedLogoUri,
        networkId: cachedLogoUri ? networkId : undefined,
      },
    },
  );

  useEffect(() => {
    const handleNetworksChanged = () => {
      deleteCachedNetworkLogoUri(networkId);
      if (networkId) {
        void fetchNetworkLogo.delete(networkId);
      }
      setCacheRevision((value) => value + 1);
      void run({ alwaysSetState: true });
    };
    appEventBus.on(EAppEventBusNames.AddedCustomNetwork, handleNetworksChanged);
    return () => {
      appEventBus.off(
        EAppEventBusNames.AddedCustomNetwork,
        handleNetworksChanged,
      );
    };
  }, [networkId, run]);

  // A result fetched for the previous network must never be shown beside the
  // new network identity while its request is still pending.
  return useMemo(
    () =>
      resolveNetworkLogoUri({
        cachedLogoUri,
        fetchedLogo,
        logoUri: ownedLogoUri,
        networkId,
      }),
    [cachedLogoUri, fetchedLogo, networkId, ownedLogoUri],
  );
}
