import { useCallback, useEffect, useRef, useState } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useSwapDefaultConfigStatusAtom,
  useSwapNetworksAtom,
} from '../../../states/jotai/contexts/swap/atoms';
import {
  canUseSwapNetworkCacheAsSortSource,
  isSwapNetworkCacheCompatible,
  isSwapNetworkCacheReadyForBasicList,
  mergeSwapNetworksWithCachedSort,
} from '../utils/swapNetworkCacheUtils';

const SWAP_NETWORK_SCHEMA_RETRY_DELAY = 30_000;

export function useSwapNetworks() {
  const [swapNetworks, setSwapNetworks] = useSwapNetworksAtom();
  const [defaultConfigStatus, setDefaultConfigStatus] =
    useSwapDefaultConfigStatusAtom();
  const [networkListFetching, setNetworkListFetching] = useState(true);
  const swapNetworksRef = useRef(swapNetworks);
  swapNetworksRef.current = swapNetworks;
  const defaultConfigStatusRef = useRef(defaultConfigStatus);
  defaultConfigStatusRef.current = defaultConfigStatus;
  const hasRefreshedSwapNetworksRef = useRef(false);
  const refreshSwapNetworksPromiseRef = useRef<Promise<void> | undefined>(
    undefined,
  );

  const fetchSwapNetworks = useCallback(async () => {
    const currentSwapNetworks = swapNetworksRef.current;
    if (currentSwapNetworks.length) {
      if (isSwapNetworkCacheCompatible(currentSwapNetworks)) {
        setNetworkListFetching(false);
        if (hasRefreshedSwapNetworksRef.current) {
          return;
        }
      } else {
        setNetworkListFetching(
          !isSwapNetworkCacheReadyForBasicList(currentSwapNetworks),
        );
      }
    }

    if (refreshSwapNetworksPromiseRef.current) {
      await refreshSwapNetworksPromiseRef.current;
      return;
    }

    const refreshPromise = (async () => {
      let receivedFreshConfiguration = false;
      try {
        let swapNetworksSortList =
          await backgroundApiProxy.simpleDb.swapNetworksSort
            .getRawData()
            .catch(() => null);
        if (swapNetworksSortList?.data?.length) {
          const cachedSwapNetworks = swapNetworksSortList.data;
          if (
            defaultConfigStatusRef.current === 'pending' &&
            (isSwapNetworkCacheCompatible(cachedSwapNetworks) ||
              isSwapNetworkCacheReadyForBasicList(cachedSwapNetworks))
          ) {
            swapNetworksRef.current = cachedSwapNetworks;
            setSwapNetworks(cachedSwapNetworks);
            setNetworkListFetching(false);
          } else if (!canUseSwapNetworkCacheAsSortSource(cachedSwapNetworks)) {
            await backgroundApiProxy.simpleDb.swapNetworksSort.setRawData({
              data: [],
            });
            swapNetworksSortList = null;
          }
        }

        // Older network caches can preserve user sorting, but selector state needs
        // the refreshed schema, especially backendIndex.
        const fetchNetworks =
          await backgroundApiProxy.serviceSwap.fetchSwapNetworks({
            refreshClientNetworks: true,
          });
        if (!fetchNetworks.length) {
          // An empty result cannot replace the selector cache or validate its defaults.
          defaultConfigStatusRef.current = 'failed';
          setDefaultConfigStatus('failed');
          return;
        }
        const networks = mergeSwapNetworksWithCachedSort({
          cachedNetworks: swapNetworksSortList?.data,
          fetchedNetworks: fetchNetworks,
        });
        swapNetworksRef.current = networks;
        setSwapNetworks(networks);
        hasRefreshedSwapNetworksRef.current =
          isSwapNetworkCacheCompatible(networks);
        receivedFreshConfiguration = true;
        defaultConfigStatusRef.current = 'success';
        setDefaultConfigStatus('success');
        if (networks.length) {
          await backgroundApiProxy.simpleDb.swapNetworksSort.setRawData({
            data: networks,
          });
        }
      } catch {
        // The background method shows its own toast. Keep cached networks usable.
        if (!receivedFreshConfiguration) {
          defaultConfigStatusRef.current = 'failed';
          setDefaultConfigStatus('failed');
        }
      } finally {
        setNetworkListFetching(false);
      }
    })().finally(() => {
      refreshSwapNetworksPromiseRef.current = undefined;
    });

    refreshSwapNetworksPromiseRef.current = refreshPromise;
    await refreshPromise;
  }, [setDefaultConfigStatus, setSwapNetworks]);

  useEffect(() => {
    if (!swapNetworks.length || isSwapNetworkCacheCompatible(swapNetworks)) {
      return;
    }

    const timer = setTimeout(() => {
      void fetchSwapNetworks();
    }, SWAP_NETWORK_SCHEMA_RETRY_DELAY);

    return () => clearTimeout(timer);
  }, [fetchSwapNetworks, swapNetworks]);

  useEffect(() => {
    void fetchSwapNetworks();
  }, [fetchSwapNetworks]);

  return {
    defaultConfigStatus,
    defaultConfigStatusRef,
    fetchSwapNetworks,
    networkListFetching,
    swapNetworks,
    swapNetworksRef,
  };
}
