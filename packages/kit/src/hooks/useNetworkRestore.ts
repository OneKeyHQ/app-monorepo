import { useEffect } from 'react';

import {
  type INetworkRestoreState,
  useNetworkRestoreState,
} from './useNetworkRestoreState';

const getBrowserInternetReachable = () => {
  if (typeof globalThis.navigator === 'undefined') {
    return null;
  }

  return globalThis.navigator.onLine;
};

export function useNetworkRestore(): INetworkRestoreState {
  const { networkState, updateInternetReachable } = useNetworkRestoreState(
    getBrowserInternetReachable(),
  );

  useEffect(() => {
    updateInternetReachable(getBrowserInternetReachable());

    if (
      typeof globalThis.addEventListener !== 'function' ||
      typeof globalThis.removeEventListener !== 'function'
    ) {
      return undefined;
    }

    const handleOnline = () => {
      updateInternetReachable(true);
    };
    const handleOffline = () => {
      updateInternetReachable(false);
    };

    globalThis.addEventListener('online', handleOnline);
    globalThis.addEventListener('offline', handleOffline);

    return () => {
      globalThis.removeEventListener('online', handleOnline);
      globalThis.removeEventListener('offline', handleOffline);
    };
  }, [updateInternetReachable]);

  return networkState;
}
