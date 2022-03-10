import { useCallback } from 'react';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { updateNetworkMap } from '../store/reducers/network';

import { useAppSelector } from './redux';

export const useManageNetworks = () => {
  const { dispatch, engine } = backgroundApiProxy;
  const allNetworks = useAppSelector((s) => s.network.network) ?? [];
  const updateNetworks = useCallback(
    async (networks: [string, boolean][]) => {
      const res = await engine.updateNetworkList(networks);
      dispatch(updateNetworkMap(res));
    },
    [dispatch, engine],
  );
  return {
    allNetworks,
    enabledNetworks: allNetworks.filter((network) => network.enabled),
    updateNetworks,
  };
};
