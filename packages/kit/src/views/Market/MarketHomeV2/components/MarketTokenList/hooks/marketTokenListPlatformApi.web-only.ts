import { fetchMarketTokenListLight } from '@onekeyhq/kit/src/views/Market/utils/marketLightApi';

import type {
  IFetchMarketTokenListForPlatformOptions,
  IMarketTokenListRequestParams,
} from './marketTokenListPlatformApiTypes';

const fetchMarketTokenListForPlatform = (
  params: IMarketTokenListRequestParams,
  options?: IFetchMarketTokenListForPlatformOptions,
) => fetchMarketTokenListLight(params, options);

export { fetchMarketTokenListForPlatform };
