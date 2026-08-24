import { useEffect, useMemo, useState } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import {
  type IFetchedNetworkLogo,
  deleteCachedNetworkLogoUri,
  getCachedNetworkLogoUri,
  resolveNetworkLogoUri,
  setCachedNetworkLogoUri,
} from './useNetworkLogoUri.utils';
import { usePromiseResult } from './usePromiseResult';

const pendingNetworkLogoRequests = new Map<string, Promise<string>>();

function fetchNetworkLogo(networkId: string): Promise<string> {
  const pendingRequest = pendingNetworkLogoRequests.get(networkId);
  if (pendingRequest) {
    return pendingRequest;
  }
  const request = (async () => {
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
  })().finally(() => {
    pendingNetworkLogoRequests.delete(networkId);
  });
  pendingNetworkLogoRequests.set(networkId, request);
  return request;
}

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
