import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import type { IMarketTokenBatchRequestParams } from './marketTokenListPlatformApiTypes';

const fetchMarketTokenListBatchForPlatform = (
  params: IMarketTokenBatchRequestParams,
) => backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch(params);

export { fetchMarketTokenListBatchForPlatform };
