import { fetchMarketTokenListBatchLight } from '@onekeyhq/kit/src/views/Market/utils/marketLightApi';

import type { IMarketTokenBatchRequestParams } from './marketTokenListPlatformApiTypes';

const fetchMarketTokenListBatchForPlatform = (
  params: IMarketTokenBatchRequestParams,
) => fetchMarketTokenListBatchLight(params);

export { fetchMarketTokenListBatchForPlatform };
