import { useCallback, useEffect, useRef, useState } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useSwapDefaultConfigStatusAtom,
  useSwapNetworkConfigStatusAtom,
  useSwapNetworksAtom,
} from '../../../states/jotai/contexts/swap/atoms';
import {
  canUseSwapNetworkCacheAsSortSource,
  isSwapNetworkCacheCompatible,
  isSwapNetworkCacheReadyForBasicList,
  mergeSwapNetworksWithCachedSort,
} from '../utils/swapNetworkCacheUtils';

const SWAP_NETWORK_RETRY_DELAY = 30_000;
const SWAP_DEFAULT_CONFIG_WAIT_MS = 2000;

export function useSwapNetworks() {
  const [swapNetworks, setSwapNetworks] = useSwapNetworksAtom();
  // This deadline belongs to the initial entry, not later Home or route intents.
  const [defaultConfigStatus, setDefaultConfigStatus] =
    useSwapDefaultConfigStatusAtom();
  const [networkConfigStatus, setNetworkConfigStatus] =
    useSwapNetworkConfigStatusAtom();
  const [networkListFetching, setNetworkListFetching] = useState(true);
  const swapNetworksRef = useRef(swapNetworks);
  swapNetworksRef.current = swapNetworks;
  const defaultConfigStatusRef = useRef(defaultConfigStatus);
  defaultConfigStatusRef.current = defaultConfigStatus;
  const networkConfigStatusRef = useRef(networkConfigStatus);
  networkConfigStatusRef.current = networkConfigStatus;
  const hasRefreshedSwapNetworksRef = useRef(false);
  const isActiveRef = useRef(true);
  const defaultConfigDeadlineRef = useRef<number | undefined>(undefined);
  const defaultConfigTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
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
          setNetworkConfigStatus('pending');
          let swapNetworksSortList =
            await backgroundApiProxy.simpleDb.swapNetworksSort
              .getRawData()
              .catch(() => null);
          if (!isActiveRef.current) {
            return;
          }
          if (swapNetworksSortList?.data?.length) {
            const cachedSwapNetworks = swapNetworksSortList.data;
            if (
              !swapNetworksRef.current.length &&
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
          if (!isActiveRef.current) {
            return;
          }

          // Older network caches can preserve user sorting, but selector state needs
          // the refreshed schema, especially backendIndex.
          const fetchNetworks =
            await backgroundApiProxy.serviceSwap.fetchSwapNetworks({
              refreshClientNetworks: true,
              ...options,
            });
          if (!isActiveRef.current) {
            return;
          }
          if (!fetchNetworks.length) {
            // An empty result cannot replace the selector cache or validate its defaults.
            setNetworkConfigStatus('failed');
            if (defaultConfigStatusRef.current === 'pending') {
              defaultConfigStatusRef.current = 'failed';
              setDefaultConfigStatus('failed');
            }
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
          setNetworkConfigStatus('success');
          if (defaultConfigStatusRef.current === 'pending') {
            // Check the clock as well as the timer: a busy JS thread can run
            // the response continuation before an overdue timeout callback.
            const status =
              Date.now() < (defaultConfigDeadlineRef.current ?? 0)
                ? 'success'
                : 'failed';
            defaultConfigStatusRef.current = status;
            setDefaultConfigStatus(status);
          }
          clearTimeout(defaultConfigTimerRef.current);
          if (networks.length) {
            await backgroundApiProxy.simpleDb.swapNetworksSort.setRawData({
              data: networks,
            });
          }
        } catch {
          // Keep cached networks usable; automatic retries suppress their error toast.
          if (isActiveRef.current && !receivedFreshConfiguration) {
            setNetworkConfigStatus('failed');
            if (defaultConfigStatusRef.current === 'pending') {
              defaultConfigStatusRef.current = 'failed';
              setDefaultConfigStatus('failed');
            }
          }
        } finally {
          clearTimeout(defaultConfigTimerRef.current);
          if (isActiveRef.current) {
            setNetworkListFetching(false);
          }
        }
      })().finally(() => {
        refreshSwapNetworksPromiseRef.current = undefined;
      });

      refreshSwapNetworksPromiseRef.current = refreshPromise;
      await refreshPromise;
    },
    [setDefaultConfigStatus, setNetworkConfigStatus, setSwapNetworks],
  );

  useEffect(() => {
    if (
      hasRefreshedSwapNetworksRef.current &&
      isSwapNetworkCacheCompatible(swapNetworks)
    ) {
      return;
    }
    if (
      networkConfigStatus !== 'failed' &&
      (!swapNetworks.length || isSwapNetworkCacheCompatible(swapNetworks))
    ) {
      return;
    }

    const timer = setInterval(() => {
      void fetchSwapNetworks({ autoHandleError: false });
    }, SWAP_NETWORK_RETRY_DELAY);

    return () => clearInterval(timer);
  }, [networkConfigStatus, fetchSwapNetworks, swapNetworks]);

  useEffect(() => {
    isActiveRef.current = true;
    if (defaultConfigDeadlineRef.current === undefined) {
      defaultConfigDeadlineRef.current =
        Date.now() + SWAP_DEFAULT_CONFIG_WAIT_MS;
      defaultConfigStatusRef.current = 'pending';
      setDefaultConfigStatus('pending');
    }
    if (defaultConfigStatusRef.current === 'pending') {
      defaultConfigTimerRef.current = setTimeout(
        () => {
          if (
            isActiveRef.current &&
            defaultConfigStatusRef.current === 'pending'
          ) {
            defaultConfigStatusRef.current = 'failed';
            setDefaultConfigStatus('failed');
          }
        },
        Math.max(0, defaultConfigDeadlineRef.current - Date.now()),
      );
    }
    void fetchSwapNetworks();
    return () => {
      isActiveRef.current = false;
      clearTimeout(defaultConfigTimerRef.current);
    };
  }, [fetchSwapNetworks, setDefaultConfigStatus]);

  return {
    defaultConfigStatus,
    defaultConfigStatusRef,
    networkConfigStatus,
    networkConfigStatusRef,
    fetchSwapNetworks,
    hasRefreshedSwapNetworksRef,
    networkListFetching,
    swapNetworks,
    swapNetworksRef,
  };
}
