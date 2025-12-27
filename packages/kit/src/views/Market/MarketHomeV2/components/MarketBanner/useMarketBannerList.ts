import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import type { IMarketBannerItem } from '@onekeyhq/shared/types/marketV2';

export function useMarketBannerList() {
  const { result: bannerList, isLoading } = usePromiseResult(
    async () => {
      const data =
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
    bannerList: bannerList || ([] as IMarketBannerItem[]),
    isLoading,
  };
}
