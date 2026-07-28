import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketBannerItem } from '@onekeyhq/shared/types/marketV2';

type IFetchMarketBannerListForPlatformOptions = {
  enableMockMarketBanner?: boolean;
};

const fetchMarketBannerListForPlatform = async (
  _options?: IFetchMarketBannerListForPlatformOptions,
): Promise<IMarketBannerItem[]> =>
  backgroundApiProxy.serviceMarketV2.fetchMarketBannerList();

export { fetchMarketBannerListForPlatform };
export type { IFetchMarketBannerListForPlatformOptions };
