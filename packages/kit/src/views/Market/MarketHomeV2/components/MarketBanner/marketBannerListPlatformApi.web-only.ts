import type { IMarketBannerItem } from '@onekeyhq/shared/types/marketV2';

import { fetchMarketBannerListLight } from '../../../utils/marketLightApi';

type IFetchMarketBannerListForPlatformOptions = {
  enableMockMarketBanner?: boolean;
};

const fetchMarketBannerListForPlatform = async ({
  enableMockMarketBanner,
}: IFetchMarketBannerListForPlatformOptions = {}): Promise<
  IMarketBannerItem[]
> => {
  if (!enableMockMarketBanner) {
    return fetchMarketBannerListLight();
  }
  const { default: backgroundApiProxy } =
    await import('@onekeyhq/kit/src/background/instance/backgroundApiProxy');
  return backgroundApiProxy.serviceMarketV2.fetchMarketBannerList();
};

export { fetchMarketBannerListForPlatform };
