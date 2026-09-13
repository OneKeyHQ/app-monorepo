import { useEffect, useMemo, useRef, useState } from 'react';

import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EMarketBannerType } from '@onekeyhq/shared/types/marketV2';
import type { IMarketBannerItem } from '@onekeyhq/shared/types/marketV2';

import {
  isMarketIndexQuoteBanner,
  isMarketMixedBanner,
} from '../../../utils/marketBannerUtils';

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
        banner.assetType !== undefined || isMarketMixedBanner(banner.type);
      if (banner.type === EMarketBannerType.Perps) {
        return banner;
      }

      try {
        if (isStockBanner || banner.type === EMarketBannerType.Stock) {
          const assets = await fetchMarketBannerStockTokenListForPlatform(
            banner.tokenListId,
          );
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

function mergeBannerQuotes(
  banners: IMarketBannerItem[],
  previous: IMarketBannerItem[] | undefined,
  preferQuotes = false,
): IMarketBannerItem[] {
  const quotes = new Map(previous?.map((banner) => [banner._id, banner]));
  return banners.map((banner) => {
    const cached = quotes.get(banner._id);
    if (
      banner.type !== EMarketBannerType.Perps &&
      !isMarketIndexQuoteBanner(banner) &&
      (preferQuotes || banner.tokens === undefined) &&
      cached?.tokens &&
      cached.tokenListId === banner.tokenListId &&
      cached.type === banner.type &&
      cached.assetType === banner.assetType
    ) {
      return { ...banner, tokens: cached.tokens };
    }
    return banner;
  });
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
  const committedResultRef = useRef<
    | {
        requestScope: typeof requestScope;
        bannerList: IMarketBannerItem[] | undefined;
      }
    | undefined
  >(undefined);
  const { result: scopedResult } = usePromiseResult<
    | { scope: string; banners: IMarketBannerItem[] }
    | IMarketBannerItem[]
    | undefined
  >(
    async () => {
      try {
        const banners = await fetchMarketBannerListForPlatform({
          enableMockMarketBanner,
        });
        return { scope, banners };
      } catch {
        // Successful data must commit before the native layout fixes its header height.
        if (currentScopeRef.current === requestScope)
          setSettledScope(requestScope);
        // Optional refresh failures preserve committed data, including native cache replay.
        const previous = committedResultRef.current;
        if (previous?.requestScope === requestScope && previous.bannerList) {
          return { scope, banners: previous.bannerList };
        }
        return undefined;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enableMockMarketBanner, locale, requestScope, scope], // Used to trigger refetch when dev setting changes
    {
      checkIsFocused: !platformEnv.isWeb,
      swrKey: platformEnv.isNative
        ? swrKeys.marketHomeBanners(locale, Boolean(enableMockMarketBanner))
        : undefined,
      // Persist the rendered snapshot below, never overwrite it with raw previews.
      swrShouldPersist: () => false,
      watchLoading: true,
      revalidateOnReconnect: true,
      revalidateOnFocus: true,
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 30 }),
    },
  );

  // Native SWR replays arrays from a locale/mode-specific key. Network
  // results carry their producing scope because hooks without a cache key retain old data.
  let bannerList: IMarketBannerItem[] | undefined;
  if (Array.isArray(scopedResult)) {
    if (platformEnv.isNative) bannerList = scopedResult;
  } else if (scopedResult?.scope === scope) {
    bannerList = scopedResult.banners;
  }

  const { result: liveQuotes } = usePromiseResult(
    async () => {
      if (!bannerList || enableMockMarketBanner) return undefined;
      return {
        source: bannerList,
        scope: requestScope,
        banners: await hydrateMarketBannerQuotes(
          mergeBannerQuotes(
            bannerList,
            committedResultRef.current?.requestScope === requestScope
              ? committedResultRef.current.bannerList
              : undefined,
          ),
        ),
      };
    },
    [bannerList, enableMockMarketBanner, requestScope],
    { checkIsFocused: !platformEnv.isWeb },
  );
  const normalizedBanners = useMemo(() => {
    let previous: IMarketBannerItem[] | undefined;
    // Only hydration for this response may replace its explicit quote rows.
    const hasCurrentQuotes =
      liveQuotes?.scope === requestScope && liveQuotes.source === bannerList;
    if (hasCurrentQuotes) {
      previous = liveQuotes.banners;
    } else if (committedResultRef.current?.requestScope === requestScope) {
      previous = committedResultRef.current.bannerList;
    }
    const banners = enableMockMarketBanner
      ? (bannerList ?? [])
      : mergeBannerQuotes(bannerList ?? [], previous, hasCurrentQuotes);
    return banners.map((banner) =>
      isMarketIndexQuoteBanner(banner) && banner.indices?.length
        ? {
            ...banner,
            type: EMarketBannerType.StockIndex,
            tokens: banner.indices,
          }
        : banner,
    );
  }, [bannerList, liveQuotes, requestScope, enableMockMarketBanner]);
  useEffect(() => {
    // A native cache-key switch can discard a render that still sees the old
    // array. Only committed renders may update the fallback or persisted data.
    if (bannerList !== undefined) {
      committedResultRef.current = {
        requestScope,
        bannerList: normalizedBanners,
      };
      if (platformEnv.isNative) {
        swrCacheUtils.set(
          swrKeys.marketHomeBanners(locale, Boolean(enableMockMarketBanner)),
          normalizedBanners,
        );
      }
    } else if (committedResultRef.current?.requestScope === requestScope) {
      committedResultRef.current = undefined;
    }
  }, [
    bannerList,
    normalizedBanners,
    requestScope,
    locale,
    enableMockMarketBanner,
  ]);

  return {
    scope,
    bannerList: normalizedBanners,
    isLoading: bannerList === undefined && settledScope !== requestScope,
    isFetched: bannerList !== undefined,
  };
}
