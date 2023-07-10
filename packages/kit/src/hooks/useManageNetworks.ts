import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import type { INetwork } from '@onekeyhq/engine/src/types';
import { CHAINS_DISPLAYED_IN_DEV } from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { makeSelector } from './redux';

export type IManageNetworks = {
  allNetworks: INetwork[];
  enabledNetworks: INetwork[];
};

const emptyArray = Object.freeze([]);

export const { use: useManageNetworks, get: getManageNetworks } = makeSelector<
  IManageNetworks,
  {
    allowSelectAllNetworks?: boolean;
  }
>((selector, { useMemo, options }) => {
  const devModeEnable = selector((s) => s.settings.devMode)?.enable;
  const networks = selector((s) => s.runtime.networks) ?? emptyArray;

  const [allNetworks, enabledNetworks] = useMemo(() => {
    const chainsToHide = devModeEnable ? [] : CHAINS_DISPLAYED_IN_DEV;

    const all = networks.filter((network) => {
      if (!options?.allowSelectAllNetworks && isAllNetworks(network.id)) {
        return false;
      }
      return (
        !chainsToHide.includes(network.impl) &&
        (platformEnv.isExtension ? !network.settings.disabledInExtension : true)
      );
    });
    if (options?.allowSelectAllNetworks) {
      all.sort((a) => (isAllNetworks(a.id) ? -1 : 1));
    }
    const enabled = all.filter((network) => network.enabled);
    return [all, enabled];
  }, [devModeEnable, networks, options?.allowSelectAllNetworks]);

  return {
    allNetworks,
    enabledNetworks,
  };
});
