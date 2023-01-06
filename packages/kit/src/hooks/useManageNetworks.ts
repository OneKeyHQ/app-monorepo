import type { INetwork } from '@onekeyhq/engine/src/types';
import { IMPL_ADA } from '@onekeyhq/shared/src/engine/engineConsts';

import { makeSelector } from './redux';

export type IManageNetworks = {
  allNetworks: INetwork[];
  enabledNetworks: INetwork[];
};

const CHAINS_DISAPLYED_IN_DEV: string[] = [IMPL_ADA];
const emptyArray = Object.freeze([]);

export const { use: useManageNetworks, get: getManageNetworks } =
  makeSelector<IManageNetworks>((selector, { useMemo }) => {
    const devModeEnable = selector((s) => s.settings.devMode)?.enable;
    const networks = selector((s) => s.runtime.networks) ?? emptyArray;

    const [allNetworks, enabledNetworks] = useMemo(() => {
      const chainsToHide = devModeEnable ? [] : CHAINS_DISAPLYED_IN_DEV;
      const all = networks.filter(
        (network) => !chainsToHide.includes(network.impl),
      );
      const enabled = all.filter((network) => network.enabled);
      return [all, enabled];
    }, [devModeEnable, networks]);

    return {
      allNetworks,
      enabledNetworks,
    };
  });
