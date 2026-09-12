import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IMarketBannerItem,
  IMarketBannerTokenListItem,
  IMarketStockPublicItem,
} from '@onekeyhq/shared/types/marketV2';

type IFetchMarketBannerListForPlatformOptions = {
  enableMockMarketBanner?: boolean;
};

const fetchMarketBannerListForPlatform = async (
  _options?: IFetchMarketBannerListForPlatformOptions,
): Promise<IMarketBannerItem[]> =>
  backgroundApiProxy.serviceMarketV2.fetchMarketBannerList();

const fetchMarketBannerTokenListForPlatform = (
  tokenListId: string,
): Promise<IMarketBannerTokenListItem[]> =>
  backgroundApiProxy.serviceMarketV2.fetchMarketBannerTokenList({
    tokenListId,
  });

const fetchMarketBannerStockTokenListForPlatform = (
  id: string,
): Promise<IMarketStockPublicItem[]> =>
  backgroundApiProxy.serviceMarketV2.fetchMarketBannerStockTokenList({ id });

export {
  fetchMarketBannerListForPlatform,
  fetchMarketBannerStockTokenListForPlatform,
  fetchMarketBannerTokenListForPlatform,
};
export type { IFetchMarketBannerListForPlatformOptions };
