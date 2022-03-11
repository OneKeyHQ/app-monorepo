import { makeSelector } from './redux';

import type { Network } from '../store/reducers/network';

export type IManageNetworks = {
  allNetworks: Network[];
  enabledNetworks: Network[];
};
export const { use: useManageNetworks, get: getManageNetworks } =
  makeSelector<IManageNetworks>((selector) => {
    const allNetworks = selector((s) => s.network.network) ?? [];
    const enabledNetworks = allNetworks.filter((network) => network.enabled);
    return {
      allNetworks,
      enabledNetworks,
    };
  });
