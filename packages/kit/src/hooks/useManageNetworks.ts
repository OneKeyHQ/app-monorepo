import { INetwork } from '@onekeyhq/engine/src/types';

import { makeSelector } from './redux';

export type IManageNetworks = {
  allNetworks: INetwork[];
  enabledNetworks: INetwork[];
};
export const { use: useManageNetworks, get: getManageNetworks } =
  makeSelector<IManageNetworks>((selector, { useMemo }) => {
    const allNetworks = selector((s) => s.runtime.networks) ?? [];
    const enabledNetworks = useMemo(
      () => allNetworks.filter((network) => network.enabled),
      [allNetworks],
    );
    return {
      allNetworks,
      enabledNetworks,
    };
  });
