import { useEffect, useMemo, useRef, useState } from 'react';

import pLimit from 'p-limit';

import { preloadImages } from '@onekeyhq/components/src/primitives/Image/preload';
import { getTokenImageResizeWidth } from '@onekeyhq/kit/src/components/Token/tokenSize';
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
  findMatchingMarketBannerToken,
  getMarketBannerTopTokens,
  isMarketIndexQuoteBanner,
  isMarketStockPerpsBanner,
} from '../../../utils/marketBannerUtils';

import {
  fetchMarketBannerListForPlatform,
  fetchMarketBannerStockTokenListForPlatform,
  fetchMarketBannerTokenListForPlatform,
} from './marketBannerListPlatformApi';

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
  previews: IMarketBannerTokenPreview[] | undefined,
): IMarketBannerTokenPreview[] {
  if (!previews?.length) return tokens;
  return tokens.map((token) => {
    const preview = findMatchingMarketBannerToken(token, tokens, previews);
    const logo = preview?.logo || token.logo;
    return logo === token.logo ? token : { ...token, logo };
  });
}

function mapBannerQuoteToken({
  stockId,
  networkId,
  address,
  logo,
  name,
  symbol,
  price,
  priceChange24hPercent,
}: IMarketBannerTokenPreview): IMarketBannerTokenPreview {
  return {
    stockId,
    networkId,
    address,
    logo,
    name,
    symbol,
    price,
    priceChange24hPercent,
  };
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
    if (isStockBanner || banner.type === EMarketBannerType.Stock) {
      const assets = await fetchMarketBannerStockTokenListForPlatform(
        banner.tokenListId,
      );
      // Keep the banner artwork while refreshing quotes: the stock endpoint
      // can provide a different rendition of the same company's logo.
      return {
        ...banner,
        tokens: applyPreviewLogos(
          assets.map((asset) =>
            mapBannerQuoteToken({
              stockId: asset.stockId,
              logo: asset.logoUrl,
              name: asset.name,
              symbol: asset.symbol,
              price: asset.price,
              priceChange24hPercent: asset.priceChange24hPercent,
            }),
          ),
          banner.tokens,
        ),
      };
    }

    if (!banner.tokenListId) return banner;
    const tokens = await fetchMarketBannerTokenListForPlatform(
      banner.tokenListId,
    );

    return {
      ...banner,
      tokens: applyPreviewLogos(
        tokens.map((token) =>
          mapBannerQuoteToken({
            networkId: token.networkId,
            address: token.address,
            logo: token.logoUrl || token.logoUrls?.[0] || '',
            name: token.name,
            symbol: token.symbol,
            price: token.price,
            priceChange24hPercent: token.priceChange24hPercent,
          }),
        ),
        banner.tokens,
      ),
    };
  } catch {
    const cached = previous;
    if (canReuseBannerQuotes(banner, cached)) {
      return {
        ...banner,
        tokens: applyPreviewLogos(cached.tokens, banner.tokens),
      };
    }
    return banner;
  }
}

export async function hydrateMarketBannerQuotes(
  banners: IMarketBannerItem[],
  previous?: IMarketBannerItem[],
  onHydrated?: (banner: IMarketBannerItem) => void | Promise<void>,
): Promise<IMarketBannerItem[]> {
  const previousById = new Map(previous?.map((banner) => [banner._id, banner]));
  return Promise.all(
    banners.map(async (banner) => {
      const hydrated = await hydrateMarketBannerQuote(
        banner,
        previousById.get(banner._id),
      );
      await onHydrated?.(hydrated);
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
        tokens: applyPreviewLogos(cached.tokens, banner.tokens),
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
      // Preload once on desktop; subsequent polling still follows tab focus.
      overrideIsFocused: platformEnv.isDesktop
        ? (focused) => focused || settledScope !== requestScope
        : undefined,
      swrKey:
        platformEnv.isNative || platformEnv.isDesktop
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

  // SWR replays arrays from a locale/mode-specific key. Network
  // results carry their producing scope because hooks without a cache key retain old data.
  let bannerList: IMarketBannerItem[] | undefined;
  if (Array.isArray(scopedResult)) {
    if (platformEnv.isNative || platformEnv.isDesktop)
      bannerList = scopedResult;
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
  const preloadBannerImages = useMemo(() => {
    const limit = pLimit(4);
    return (uris: string[]) =>
      Promise.all(
        [...new Set(uris)]
          .filter(Boolean)
          .map((uri) =>
            limit(() =>
              preloadImages([
                { uri, resizeWidth: getTokenImageResizeWidth('xs') },
              ]),
            ),
          ),
      );
  }, []);
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
        ? async (hydrated: IMarketBannerItem) => {
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
              const previewTokens = previews.get(hydrated._id)?.tokens ?? [];
              const preview = getMarketBannerTopTokens(previewTokens);
              const quotes = hydrated.tokens;
              updated = {
                ...hydrated,
                tokens:
                  preserveInitialRows && preview.length
                    ? preview.map((token) => {
                        const quote = findMatchingMarketBannerToken(
                          token,
                          previewTokens,
                          quotes,
                        );
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
            if (
              source.slice(0, 4).some((banner) => banner._id === updated._id)
            ) {
              const displayed = committedResultRef.current?.bannerList?.find(
                (banner) => banner._id === updated._id,
              );
              const displayedLogos = new Set(
                displayed?.tokens?.map((token) => token.logo),
              );
              // Warm incoming rows before replacing cached rows so their
              // images paint on mount instead of flashing a loading skeleton.
              await preloadBannerImages(
                (updated.tokens ?? [])
                  .slice(0, 3)
                  .map((token) => token.logo)
                  .filter((uri) => !displayedLogos.has(uri)),
              );
            }
            if (
              currentScopeRef.current !== requestScope ||
              bannerListRef.current !== source ||
              hydrationSequenceRef.current !== sequence
            )
              return;
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
    [bannerList, enableMockMarketBanner, requestScope, preloadBannerImages],
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
      if (platformEnv.isNative || platformEnv.isDesktop) {
        swrCacheUtils.set(
          swrKeys.marketHomeBanners(locale, Boolean(enableMockMarketBanner)),
          normalizedBanners,
        );
      }
      if (platformEnv.isDesktop) setSettledScope(requestScope);
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

  useEffect(() => {
    if (!platformEnv.isDesktop || !bannerList) return undefined;
    // Warm the first four cards only, without competing with Wallet startup
    // for every off-screen logo. Match the quote row's optimized rendition.
    void preloadBannerImages(
      bannerList
        .slice(0, 4)
        .flatMap((banner) =>
          getMarketBannerTopTokens(banner.tokens).map((token) => token.logo),
        ),
    );
  }, [bannerList, preloadBannerImages]);

  return {
    scope,
    bannerList: normalizedBanners,
    isLoading: bannerList === undefined && settledScope !== requestScope,
    isFetched: bannerList !== undefined,
  };
}
