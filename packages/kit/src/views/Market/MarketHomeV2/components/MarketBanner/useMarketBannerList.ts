import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IMarketBannerItem } from '@onekeyhq/shared/types/marketV2';

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
      const data: IMarketBannerItem[] =
        await backgroundApiProxy.serviceMarketV2.fetchMarketBannerList();
      return data;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enableMockMarketBanner], // Used to trigger refetch when dev setting changes
    {
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
