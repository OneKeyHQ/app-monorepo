import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import type { IServerNetwork } from '@onekeyhq/shared/types';

const backgroundApiProxy = {
  serviceNetwork: {
    getNetworksByImpls({
      impls,
    }: {
      impls: string[];
    }): Promise<{ networks: IServerNetwork[] }> {
      const networks = getPresetNetworks();
      return Promise.resolve({
        networks: networks.filter((n) => impls.includes(n.impl)),
      });
    },
  },
};

export default backgroundApiProxy;
