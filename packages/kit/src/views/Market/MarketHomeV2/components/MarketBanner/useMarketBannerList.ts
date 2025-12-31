import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IMarketBannerItem } from '@onekeyhq/shared/types/marketV2';

export function useMarketBannerList(): {
  bannerList: IMarketBannerItem[];
  isLoading: boolean;
} {
  const { result: bannerList, isLoading } = usePromiseResult<
    IMarketBannerItem[]
  >(
    async () => {
      const data: IMarketBannerItem[] =
        await backgroundApiProxy.serviceMarketV2.fetchMarketBannerList();
      return data;
    },
    [],
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
