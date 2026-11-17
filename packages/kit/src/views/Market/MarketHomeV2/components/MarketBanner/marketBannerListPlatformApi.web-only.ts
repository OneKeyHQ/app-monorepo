import type {
  IMarketBannerItem,
  IMarketBannerTokenListItem,
  IMarketStockPublicItem,
} from '@onekeyhq/shared/types/marketV2';

import {
  fetchMarketBannerListLight,
  fetchMarketBannerStockTokenListLight,
  fetchMarketBannerTokenListLight,
} from '../../../utils/marketLightApi';

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

const fetchMarketBannerTokenListForPlatform = (
  tokenListId: string,
): Promise<IMarketBannerTokenListItem[]> =>
  fetchMarketBannerTokenListLight(tokenListId);

const fetchMarketBannerStockTokenListForPlatform = (
  id: string,
): Promise<IMarketStockPublicItem[]> =>
  fetchMarketBannerStockTokenListLight(id);

export {
  fetchMarketBannerListForPlatform,
  fetchMarketBannerStockTokenListForPlatform,
  fetchMarketBannerTokenListForPlatform,
};
