import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import type { INetwork } from '@onekeyhq/engine/src/types';
import { freezedEmptyArray } from '@onekeyhq/shared/src/consts/sharedConsts';
import { CHAINS_DISPLAYED_IN_DEV } from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { buildCrossHooks, buildCrossHooksWithOptions } from './buildCrossHooks';

export type IManageNetworks = {
  allNetworks: INetwork[];
  enabledNetworks: INetwork[];
};

export const { use: useManageNetworks, get: getManageNetworks } =
  buildCrossHooksWithOptions<
    IManageNetworks,
    | {
        allowSelectAllNetworks?: boolean;
      }
    | undefined
  >((selector, { useMemo, options }) => {
    const devModeEnable = selector((s) => s.settings.devMode)?.enable;
    const networks = selector((s) => s.runtime.networks) ?? freezedEmptyArray;

    const [allNetworks, enabledNetworks] = useMemo(() => {
      const chainsToHide = devModeEnable ? [] : CHAINS_DISPLAYED_IN_DEV;

      const all = networks.filter((network) => {
        if (!options?.allowSelectAllNetworks && isAllNetworks(network.id)) {
          return false;
        }
        return (
          !chainsToHide.includes(network.impl) &&
          (platformEnv.isExtension
            ? !network.settings.disabledInExtension
            : true)
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
