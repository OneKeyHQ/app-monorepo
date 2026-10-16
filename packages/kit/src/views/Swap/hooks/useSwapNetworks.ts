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

const SWAP_NETWORK_RETRY_DELAY = 30_000;

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

  const fetchSwapNetworks = useCallback(
    async (options?: { autoHandleError?: boolean }) => {
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
            } else if (
              !canUseSwapNetworkCacheAsSortSource(cachedSwapNetworks)
            ) {
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
              ...options,
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
          // Keep cached networks usable; automatic retries suppress their error toast.
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
    },
    [setDefaultConfigStatus, setSwapNetworks],
  );

  useEffect(() => {
    if (
      defaultConfigStatus !== 'failed' &&
      (!swapNetworks.length || isSwapNetworkCacheCompatible(swapNetworks))
    ) {
      return;
    }

    const timer = setInterval(() => {
      void fetchSwapNetworks({ autoHandleError: false });
    }, SWAP_NETWORK_RETRY_DELAY);

    return () => clearInterval(timer);
  }, [defaultConfigStatus, fetchSwapNetworks, swapNetworks]);

  useEffect(() => {
    void fetchSwapNetworks();
  }, [fetchSwapNetworks]);

  return {
    defaultConfigStatus,
    defaultConfigStatusRef,
    fetchSwapNetworks,
    hasRefreshedSwapNetworksRef,
    networkListFetching,
    swapNetworks,
    swapNetworksRef,
  };
}
