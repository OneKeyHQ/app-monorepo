import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import type { IMarketKLineDataResponse } from './fetchMarketKLineData';

export async function fetchMarketAssetKLineData({
  assetId,
  interval,
  timeFrom,
  timeTo,
}: {
  assetId: string;
  interval: string;
  timeFrom?: number;
  timeTo?: number;
}): Promise<IMarketKLineDataResponse> {
  return backgroundApiProxy.serviceMarket.fetchMarketAssetKline({
    assetId,
    interval,
    timeFrom,
    timeTo,
    currency: 'usd',
    autoHandleError: false,
  });
}
