import { useMemo, useRef, useState } from 'react';

import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EMarketBannerType } from '@onekeyhq/shared/types/marketV2';
import type { IMarketBannerItem } from '@onekeyhq/shared/types/marketV2';

import { isMarketIndexQuoteBanner } from '../../../utils/marketBannerUtils';

import {
  fetchMarketBannerListForPlatform,
  fetchMarketBannerStockTokenListForPlatform,
  fetchMarketBannerTokenListForPlatform,
} from './marketBannerListPlatformApi';

export async function hydrateMarketBannerQuotes(
  banners: IMarketBannerItem[],
): Promise<IMarketBannerItem[]> {
  const hydratedBanners = await Promise.all(
    banners.map(async (banner) => {
      // Index banners expose quote rows in `indices`; they do not have a
      // token-list response. Convert those rows to the common banner preview
      // shape before rendering so the card does not fall back to `--`.
      if (isMarketIndexQuoteBanner(banner)) {
        const indices = banner.indices ?? [];
        return indices.length ? { ...banner, tokens: indices } : banner;
      }

      const isStockBanner =
        banner.assetType !== undefined ||
        banner.type === EMarketBannerType.StockPerps;
      if (banner.type === EMarketBannerType.Perps) {
        return banner;
      }

      try {
        if (isStockBanner || banner.type === EMarketBannerType.Stock) {
          const assets = await fetchMarketBannerStockTokenListForPlatform(
            banner.tokenListId,
          );
          if (!assets.length) return banner;
          return {
            ...banner,
            tokens: assets.map((asset) => ({
              logo: asset.logoUrl,
              name: asset.name,
              symbol: asset.symbol,
              price: asset.price,
              priceChange24hPercent: asset.priceChange24hPercent,
            })),
          };
        }

        if (!banner.tokenListId) return banner;
        const tokens = await fetchMarketBannerTokenListForPlatform(
          banner.tokenListId,
        );
        if (!tokens.length) return banner;

        return {
          ...banner,
          tokens: tokens.map((token) => ({
            logo: token.logoUrl ?? token.logoUrls?.[0] ?? '',
            name: token.name,
            symbol: token.symbol,
            price: token.price,
            priceChange24hPercent: token.priceChange24hPercent,
          })),
        };
      } catch {
        return banner;
      }
    }),
  );

  return hydratedBanners;
}

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
      } catch (error) {
        // Successful data must commit before the native layout fixes its header height.
        if (currentScopeRef.current === requestScope)
          setSettledScope(requestScope);
        throw error;
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
      revalidateOnFocus: true,
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 30 }),
    },
  );

  const { result: liveQuotes } = usePromiseResult(
    async () => {
      if (!bannerList || enableMockMarketBanner) return undefined;
      return {
        source: bannerList,
        scope: requestScope,
        banners: await hydrateMarketBannerQuotes(bannerList),
      };
    },
    [bannerList, enableMockMarketBanner, requestScope],
    { checkIsFocused: !platformEnv.isWeb },
  );
  const displayedBanners =
    liveQuotes?.source === bannerList && liveQuotes?.scope === requestScope
      ? liveQuotes.banners
      : bannerList;
  const normalizedBanners = useMemo(
    () =>
      (displayedBanners ?? []).map((banner) =>
        isMarketIndexQuoteBanner(banner) && banner.indices?.length
          ? {
              ...banner,
              type: EMarketBannerType.StockIndex,
              tokens: banner.indices,
            }
          : banner,
      ),
    [displayedBanners],
  );

  return {
    scope,
    bannerList: normalizedBanners,
    isLoading: bannerList === undefined && settledScope !== requestScope,
    isFetched: bannerList !== undefined,
  };
}
