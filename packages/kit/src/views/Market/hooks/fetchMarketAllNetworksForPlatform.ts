import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IServerNetwork } from '@onekeyhq/shared/types';

const fetchMarketAllNetworksForPlatform = async (): Promise<
  IServerNetwork[]
> => {
  const { networks } = await backgroundApiProxy.serviceNetwork.getAllNetworks();
  return networks;
};

export { fetchMarketAllNetworksForPlatform };
