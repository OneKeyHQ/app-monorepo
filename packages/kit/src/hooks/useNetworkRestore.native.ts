import { useCallback, useEffect } from 'react';

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

import {
  type INetworkRestoreState,
  useNetworkRestoreState,
} from './useNetworkRestoreState';

const getInternetReachableFromNativeState = (state: NetInfoState) =>
  state.isInternetReachable ?? state.isConnected ?? null;

export function useNetworkRestore(): INetworkRestoreState {
  const { networkState, updateInternetReachable } =
    useNetworkRestoreState(null);

  const updateFromNativeState = useCallback(
    (state: NetInfoState) => {
      updateInternetReachable(getInternetReachableFromNativeState(state));
    },
    [updateInternetReachable],
  );

  useEffect(() => {
    void NetInfo.fetch()
      .then(updateFromNativeState)
      .catch(() => undefined);
    return NetInfo.addEventListener(updateFromNativeState);
  }, [updateFromNativeState]);

  return networkState;
}
