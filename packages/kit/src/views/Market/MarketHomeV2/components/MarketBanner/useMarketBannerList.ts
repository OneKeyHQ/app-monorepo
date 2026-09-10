import { useMemo, useRef, useState } from 'react';

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
  scope: string;
} {
  const locale = useLocaleVariant();
  const [devSettings] = useDevSettingsPersistAtom();
  const enableMockMarketBanner =
    devSettings.enabled && devSettings.settings?.enableMockMarketBanner;

  const scope = `${locale}:${Boolean(enableMockMarketBanner)}`;
  const requestScope = useMemo(() => ({ scope }), [scope]);
  const currentScopeRef = useRef(requestScope);
  currentScopeRef.current = requestScope;
  const [settledScope, setSettledScope] = useState<typeof requestScope>();
  const { result: bannerList } = usePromiseResult<IMarketBannerItem[]>(
    async () => {
      try {
        return await fetchMarketBannerListForPlatform({
          enableMockMarketBanner,
        });
      } finally {
        if (currentScopeRef.current === requestScope)
          setSettledScope(requestScope);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enableMockMarketBanner, locale, requestScope], // Used to trigger refetch when dev setting changes
    {
      checkIsFocused: !platformEnv.isWeb,
      swrKey: platformEnv.isNative
        ? swrKeys.marketHomeBanners(locale, Boolean(enableMockMarketBanner))
        : undefined,
      watchLoading: true,
      // Optional banners must not turn a failed request into a page error.
      undefinedResultIfError: true,
      revalidateOnReconnect: true,
    },
  );

  return {
    scope,
    bannerList: bannerList || [],
    isLoading: bannerList === undefined && settledScope !== requestScope,
    isFetched: bannerList !== undefined,
  };
}
