import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import type {
  IFetchMarketTokenListForPlatformOptions,
  IMarketTokenListRequestParams,
} from './marketTokenListPlatformApiTypes';

const fetchMarketTokenListForPlatform = (
  params: IMarketTokenListRequestParams,
  _options?: IFetchMarketTokenListForPlatformOptions,
) => backgroundApiProxy.serviceMarketV2.fetchMarketTokenList(params);

export { fetchMarketTokenListForPlatform };
