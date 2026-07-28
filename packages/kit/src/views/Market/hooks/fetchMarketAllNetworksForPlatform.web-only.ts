import type { IServerNetwork } from '@onekeyhq/shared/types';

import { fetchMarketBasicConfigLight } from '../utils/marketLightApi';

import { buildMarketNetworkFromBasicConfig } from './marketNetworkUtils';

const fetchMarketAllNetworksForPlatform = async (): Promise<
  IServerNetwork[]
> => {
  const response = await fetchMarketBasicConfigLight();
  return (response.data.networkList ?? []).map((network) =>
    buildMarketNetworkFromBasicConfig(network),
  );
};

export { fetchMarketAllNetworksForPlatform };
