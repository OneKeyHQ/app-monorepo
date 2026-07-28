import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketBasicConfigResponse } from '@onekeyhq/shared/types/marketV2';

const fetchMarketBasicConfigForPlatform =
  async (): Promise<IMarketBasicConfigResponse> =>
    backgroundApiProxy.serviceMarketV2.fetchMarketBasicConfig();

export { fetchMarketBasicConfigForPlatform };
