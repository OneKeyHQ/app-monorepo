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
import type {
  IMarketBannerItem,
  IMarketBannerTokenPreview,
} from '@onekeyhq/shared/types/marketV2';

import {
  getMarketBannerTopTokens,
  isMarketIndexQuoteBanner,
  isMarketStockPerpsBanner,
} from '../../../utils/marketBannerUtils';

import {
  fetchMarketBannerListForPlatform,
  fetchMarketBannerStockTokenListForPlatform,
  fetchMarketBannerTokenListForPlatform,
} from './marketBannerListPlatformApi';

function bannerPreviewLogos(
  tokens: IMarketBannerTokenPreview[] | undefined,
): Map<string, string> {
  return new Map(tokens?.map((token) => [token.symbol, token.logo]));
}

function canReuseBannerQuotes(
  banner: IMarketBannerItem,
  cached: IMarketBannerItem | undefined,
): cached is IMarketBannerItem & { tokens: IMarketBannerTokenPreview[] } {
  return (
    banner.type !== EMarketBannerType.Perps &&
    !isMarketIndexQuoteBanner(banner) &&
    !!cached?.tokens &&
    cached.tokenListId === banner.tokenListId &&
    cached.type === banner.type &&
    cached.assetType === banner.assetType
  );
}

function applyPreviewLogos(
  tokens: IMarketBannerTokenPreview[],
  previewLogos: Map<string, string>,
): IMarketBannerTokenPreview[] {
  if (previewLogos.size === 0) return tokens;
  return tokens.map((token) => {
    const logo = previewLogos.get(token.symbol) || token.logo;
    return logo === token.logo ? token : { ...token, logo };
  });
}

function mapBannerQuoteToken({
  logo,
  name,
  symbol,
  price,
  priceChange24hPercent,
}: {
  logo: string;
  name: string;
  symbol: string;
  price?: string;
  priceChange24hPercent?: string;
}): IMarketBannerTokenPreview {
  return { logo, name, symbol, price, priceChange24hPercent };
}

async function hydrateMarketBannerQuote(
  banner: IMarketBannerItem,
  previous?: IMarketBannerItem,
): Promise<IMarketBannerItem> {
  // Index banners expose quote rows in `indices`; they do not have a
  // token-list response. Convert those rows to the common banner preview
  // shape before rendering so the card does not fall back to `--`.
  if (isMarketIndexQuoteBanner(banner)) {
    const indices = banner.indices ?? [];
    return indices.length ? { ...banner, tokens: indices } : banner;
  }

  const isStockBanner =
    banner.assetType !== undefined || isMarketStockPerpsBanner(banner.type);
  if (banner.type === EMarketBannerType.Perps) {
    return banner;
  }

  try {
    const previewLogos = bannerPreviewLogos(banner.tokens);
    if (isStockBanner || banner.type === EMarketBannerType.Stock) {
      const assets = await fetchMarketBannerStockTokenListForPlatform(
        banner.tokenListId,
      );
      // Keep the banner artwork while refreshing quotes: the stock endpoint
      // can provide a different rendition of the same company's logo.
      return {
        ...banner,
        tokens: assets.map((asset) =>
          mapBannerQuoteToken({
            logo: previewLogos.get(asset.symbol) || asset.logoUrl,
            name: asset.name,
            symbol: asset.symbol,
            price: asset.price,
            priceChange24hPercent: asset.priceChange24hPercent,
          }),
        ),
      };
    }

    if (!banner.tokenListId) return banner;
    const tokens = await fetchMarketBannerTokenListForPlatform(
      banner.tokenListId,
    );

    return {
      ...banner,
      tokens: tokens.map((token) =>
        mapBannerQuoteToken({
          logo:
            previewLogos.get(token.symbol) ||
            token.logoUrl ||
            token.logoUrls?.[0] ||
            '',
          name: token.name,
          symbol: token.symbol,
          price: token.price,
          priceChange24hPercent: token.priceChange24hPercent,
        }),
      ),
    };
  } catch {
    const cached = previous;
    if (canReuseBannerQuotes(banner, cached)) {
      return {
        ...banner,
        tokens: applyPreviewLogos(
          cached.tokens,
          bannerPreviewLogos(banner.tokens),
        ),
      };
    }
    return banner;
  }
}

export async function hydrateMarketBannerQuotes(
  banners: IMarketBannerItem[],
  previous?: IMarketBannerItem[],
  onHydrated?: (banner: IMarketBannerItem) => void,
): Promise<IMarketBannerItem[]> {
  const previousById = new Map(previous?.map((banner) => [banner._id, banner]));
  return Promise.all(
    banners.map(async (banner) => {
      const hydrated = await hydrateMarketBannerQuote(
        banner,
        previousById.get(banner._id),
      );
      onHydrated?.(hydrated);
      return hydrated;
    }),
  );
}

function mergeBannerQuotes(
  banners: IMarketBannerItem[],
  previous: IMarketBannerItem[] | undefined,
): IMarketBannerItem[] {
  const quotes = new Map(previous?.map((banner) => [banner._id, banner]));
  return banners.map((banner) => {
    const cached = quotes.get(banner._id);
    // Keep hydrated quote rows across list polls so preview membership does
    // not flash. Overlay the latest preview logos onto those rows.
    if (canReuseBannerQuotes(banner, cached)) {
      return {
        ...banner,
        tokens: applyPreviewLogos(
          cached.tokens,
          bannerPreviewLogos(banner.tokens),
        ),
      };
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

  const bannerListRef = useRef(bannerList);
  bannerListRef.current = bannerList;
  // Preserve only the first preview response, not subsequent ranking polls.
  const initialDesktopListRef = useRef<
    | {
        scope: typeof requestScope;
        source: IMarketBannerItem[];
      }
    | undefined
  >(undefined);
  if (
    platformEnv.isDesktop &&
    bannerList?.length &&
    initialDesktopListRef.current?.scope !== requestScope
  ) {
    initialDesktopListRef.current = { scope: requestScope, source: bannerList };
  }
  const [desktopQuotes, setDesktopQuotes] = useState<{
    scope: typeof requestScope;
    source: IMarketBannerItem[];
    banners: IMarketBannerItem[];
  }>();
  const hydrationSequenceRef = useRef(0);
  useEffect(
    () => () => {
      hydrationSequenceRef.current += 1;
    },
    [],
  );
  const { result: liveQuotes } = usePromiseResult(
    async () => {
      hydrationSequenceRef.current += 1;
      const sequence = hydrationSequenceRef.current;
      if (!bannerList || enableMockMarketBanner) return undefined;
      const source = bannerList;
      const preserveInitialRows =
        initialDesktopListRef.current?.scope === requestScope &&
        initialDesktopListRef.current.source === source;
      const previews = new Map(source.map((banner) => [banner._id, banner]));
      // Publish each desktop card as it settles, independently of slow peers.
      const onHydrated = platformEnv.isDesktop
        ? (hydrated: IMarketBannerItem) => {
            if (
              currentScopeRef.current !== requestScope ||
              bannerListRef.current !== source ||
              hydrationSequenceRef.current !== sequence
            )
              return;
            let updated = hydrated;
            if (
              hydrated.tokens &&
              !isMarketIndexQuoteBanner(hydrated) &&
              hydrated.type !== EMarketBannerType.Perps
            ) {
              const preview = getMarketBannerTopTokens(
                previews.get(hydrated._id)?.tokens,
              );
              const quotes = new Map(
                hydrated.tokens?.map((token) => [token.symbol, token]),
              );
              updated = {
                ...hydrated,
                tokens:
                  preserveInitialRows && preview.length
                    ? preview.map((token) => {
                        const quote = quotes.get(token.symbol);
                        return quote
                          ? {
                              ...token,
                              logo: token.logo || quote.logo,
                              price: quote.price,
                              priceChange24hPercent:
                                quote.priceChange24hPercent,
                            }
                          : token;
                      })
                    : getMarketBannerTopTokens(hydrated.tokens),
              };
            }
            setDesktopQuotes((previous) => ({
              scope: requestScope,
              source,
              banners: [
                ...(previous?.scope === requestScope &&
                previous.source === source
                  ? previous.banners.filter(
                      (banner) => banner._id !== updated._id,
                    )
                  : []),
                updated,
              ],
            }));
          }
        : undefined;
      return {
        source: bannerList,
        scope: requestScope,
        banners: await hydrateMarketBannerQuotes(
          bannerList,
          committedResultRef.current?.requestScope === requestScope
            ? committedResultRef.current.bannerList
            : undefined,
          onHydrated,
        ),
      };
    },
    [bannerList, enableMockMarketBanner, requestScope],
    { checkIsFocused: !platformEnv.isWeb },
  );
  const normalizedBanners = useMemo(() => {
    let previous: IMarketBannerItem[] | undefined;
    // Hydration for this list response may replace rows; list polls keep them.
    const hasCurrentQuotes =
      liveQuotes?.scope === requestScope && liveQuotes.source === bannerList;
    if (platformEnv.isDesktop) {
      const quotes = new Map(
        committedResultRef.current?.requestScope === requestScope
          ? committedResultRef.current.bannerList?.map((banner) => [
              banner._id,
              banner,
            ])
          : [],
      );
      if (
        desktopQuotes?.scope === requestScope &&
        desktopQuotes.source === bannerList
      ) {
        desktopQuotes.banners.forEach((banner) =>
          quotes.set(banner._id, banner),
        );
      }
      previous = [...quotes.values()];
    } else if (hasCurrentQuotes) {
      previous = liveQuotes.banners;
    } else if (committedResultRef.current?.requestScope === requestScope) {
      previous = committedResultRef.current.bannerList;
    }
    const banners = enableMockMarketBanner
      ? (bannerList ?? [])
      : mergeBannerQuotes(bannerList ?? [], previous);
    const previousById = new Map(
      previous?.map((banner) => [banner._id, banner]),
    );
    return banners.map((banner) => {
      if (isMarketIndexQuoteBanner(banner) && banner.indices?.length) {
        return {
          ...banner,
          type: EMarketBannerType.StockIndex,
          tokens: banner.indices,
        };
      }
      if (
        platformEnv.isDesktop &&
        banner.tokens &&
        (enableMockMarketBanner ||
          !canReuseBannerQuotes(banner, previousById.get(banner._id))) &&
        !isMarketIndexQuoteBanner(banner)
      ) {
        return { ...banner, tokens: getMarketBannerTopTokens(banner.tokens) };
      }
      return banner;
    });
  }, [
    bannerList,
    liveQuotes,
    desktopQuotes,
    requestScope,
    enableMockMarketBanner,
  ]);
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
