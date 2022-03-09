import { useCallback } from 'react';

import engine from '../engine/EngineProvider';
import { updateNetworkMap } from '../store/reducers/network';

import { useAppDispatch, useAppSelector } from './redux';

export const useManageNetworks = () => {
  const dispatch = useAppDispatch();
  const allNetworks = useAppSelector((s) => s.network.network) ?? [];
  const updateNetworks = useCallback(
    async (networks: [string, boolean][]) => {
      const res = await engine.updateNetworkList(networks);
      dispatch(updateNetworkMap(res));
    },
    [dispatch],
  );
  return {
    allNetworks,
    enabledNetworks: allNetworks.filter((network) => network.enabled),
    updateNetworks,
  };
};
