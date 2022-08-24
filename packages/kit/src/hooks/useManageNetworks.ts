import { INetwork } from '@onekeyhq/engine/src/types';

import { makeSelector } from './redux';

export type IManageNetworks = {
  allNetworks: INetwork[];
  enabledNetworks: INetwork[];
};
const emptyArray = Object.freeze([]);
export const { use: useManageNetworks, get: getManageNetworks } =
  makeSelector<IManageNetworks>((selector, { useMemo }) => {
    const allNetworks = selector((s) => s.runtime.networks) ?? emptyArray;
    const enabledNetworks = useMemo(
      () => allNetworks.filter((network) => network.enabled),
      [allNetworks],
    );
    return {
      allNetworks,
      enabledNetworks,
    };
  });
