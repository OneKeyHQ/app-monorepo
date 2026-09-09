import { useState } from 'react';

import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IMarketBannerItem } from '@onekeyhq/shared/types/marketV2';

import { fetchMarketBannerListForPlatform } from './marketBannerListPlatformApi';

export function useMarketBannerList(): {
  bannerList: IMarketBannerItem[];
  isLoading: boolean;
  isFetched: boolean;
} {
  const locale = useLocaleVariant();
  const [devSettings] = useDevSettingsPersistAtom();
  const enableMockMarketBanner =
    devSettings.enabled && devSettings.settings?.enableMockMarketBanner;

  const scope = `${locale}:${Boolean(enableMockMarketBanner)}`;
  const [settledScope, setSettledScope] = useState<string>();
  const { result: bannerList, isLoading } = usePromiseResult<
    IMarketBannerItem[]
  >(
    async () => {
      return fetchMarketBannerListForPlatform({ enableMockMarketBanner });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enableMockMarketBanner, locale], // Used to trigger refetch when dev setting changes
    {
      checkIsFocused: !platformEnv.isWeb,
      swrKey: platformEnv.isNative
        ? swrKeys.marketHomeBanners(locale, Boolean(enableMockMarketBanner))
        : undefined,
      watchLoading: true,
      revalidateOnReconnect: true,
    },
  );

  if (isLoading === false && settledScope !== scope) setSettledScope(scope);

  return {
    bannerList: bannerList || [],
    isLoading:
      bannerList === undefined && settledScope !== scope && isLoading !== false,
    isFetched: bannerList !== undefined,
  };
}
