import { useMemo, useRef, useState } from 'react';

import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
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
  const committedResultRef = useRef<
    | {
        requestScope: typeof requestScope;
        bannerList: IMarketBannerItem[] | undefined;
      }
    | undefined
  >(undefined);
  const { result: bannerList } = usePromiseResult<
    IMarketBannerItem[] | undefined
  >(
    async () => {
      try {
        return await fetchMarketBannerListForPlatform({
          enableMockMarketBanner,
        });
      } catch {
        // Successful data must commit before the native layout fixes its header height.
        if (currentScopeRef.current === requestScope)
          setSettledScope(requestScope);
        // Optional refresh failures preserve committed data, including native cache replay.
        return committedResultRef.current?.requestScope === requestScope
          ? committedResultRef.current.bannerList
          : undefined;
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
      revalidateOnReconnect: true,
      revalidateOnFocus: true,
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 30 }),
    },
  );

  committedResultRef.current = { requestScope, bannerList };

  return {
    scope,
    bannerList: bannerList || [],
    isLoading: bannerList === undefined && settledScope !== requestScope,
    isFetched: bannerList !== undefined,
  };
}
