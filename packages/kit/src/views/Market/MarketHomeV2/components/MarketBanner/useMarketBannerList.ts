import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IMarketBannerItem } from '@onekeyhq/shared/types/marketV2';

export function useMarketBannerList(): {
  bannerList: IMarketBannerItem[];
  isLoading: boolean;
} {
  const [devSettings] = useDevSettingsPersistAtom();
  const enableMockMarketBanner =
    devSettings.enabled && devSettings.settings?.enableMockMarketBanner;

  const { result: bannerList, isLoading } = usePromiseResult<
    IMarketBannerItem[]
  >(
    async () => {
      // enableMockMarketBanner is used as dependency to trigger refetch when dev setting changes
      void enableMockMarketBanner;
      const data: IMarketBannerItem[] =
        await backgroundApiProxy.serviceMarketV2.fetchMarketBannerList();
      return data;
    },
    [enableMockMarketBanner],
    {
      watchLoading: true,
      revalidateOnReconnect: true,
    },
  );

  return {
    bannerList: bannerList || [],
    isLoading,
  };
}
