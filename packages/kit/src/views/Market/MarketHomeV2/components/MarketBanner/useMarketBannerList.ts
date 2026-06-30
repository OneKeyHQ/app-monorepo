import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketBannerItem } from '@onekeyhq/shared/types/marketV2';

import { fetchMarketBannerListForPlatform } from './marketBannerListPlatformApi';

export function useMarketBannerList(): {
  bannerList: IMarketBannerItem[];
  isLoading: boolean;
  isFetched: boolean;
} {
  const [devSettings] = useDevSettingsPersistAtom();
  const enableMockMarketBanner =
    devSettings.enabled && devSettings.settings?.enableMockMarketBanner;

  const { result: bannerList, isLoading } = usePromiseResult<
    IMarketBannerItem[]
  >(
    async () => {
      return fetchMarketBannerListForPlatform({ enableMockMarketBanner });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enableMockMarketBanner], // Used to trigger refetch when dev setting changes
    {
      checkIsFocused: !platformEnv.isWeb,
      watchLoading: true,
      revalidateOnReconnect: true,
    },
  );

  return {
    bannerList: bannerList || [],
    isLoading: isLoading ?? false,
    isFetched: bannerList !== undefined,
  };
}
