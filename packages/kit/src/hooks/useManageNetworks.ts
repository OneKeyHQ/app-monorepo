import type { INetwork } from '@onekeyhq/kit/src/store/reducers/runtime';

import { makeSelector } from './redux';

export type IManageNetworks = {
  allNetworks: INetwork[];
  enabledNetworks: INetwork[];
};
export const { use: useManageNetworks, get: getManageNetworks } =
  makeSelector<IManageNetworks>((selector) => {
    const allNetworks = selector((s) => s.runtime.networks) ?? [];
    const enabledNetworks = allNetworks.filter((network) => network.enabled);
    return {
      allNetworks,
      enabledNetworks,
    };
  });
