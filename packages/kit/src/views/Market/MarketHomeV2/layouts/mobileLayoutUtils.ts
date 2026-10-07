import { s } from '@onekeyhq/components/src/utils/scale';

// The category chip row under the tab bar: a 32pt chip with 12pt above and
// below. The native Stocks sub-header centers its chips in this height, so the
// JS chip rows use the same even padding to line up with it.
export const MARKET_MOBILE_CATEGORY_ROW_HEIGHT = 56;
export const MARKET_MOBILE_COLUMN_HEADER_HEIGHT = 32;
// The whole secondary header must fit its content: the layouts pin it to this
// height and bottom-align the rows, so anything taller slides under the tab bar.
export const MARKET_MOBILE_SECONDARY_HEADER_HEIGHT =
  MARKET_MOBILE_CATEGORY_ROW_HEIGHT + MARKET_MOBILE_COLUMN_HEADER_HEIGHT;
// Tabs with no chip row (e.g. Top Coins) keep the same 12pt lead under the tab
// bar before their column header.
export const MARKET_MOBILE_COMPACT_SECONDARY_HEADER_HEIGHT =
  12 + MARKET_MOBILE_COLUMN_HEADER_HEIGHT;
export const MARKET_MOBILE_CONTENT_TOP_GAP = 16;

// Banner card height plus the mobile scroller's 16pt top and bottom padding:
// 180pt modern cards and 118pt legacy cards. Modern cards follow the Android UI
// scale, so their height does too.
const MARKET_MOBILE_BANNER_MODERN_HEIGHT = s(212);
const MARKET_MOBILE_BANNER_LEGACY_HEIGHT = 150;

export function getMarketMobileBannerHeaderHeight(
  bannerList: readonly { tokens?: unknown }[],
) {
  const isModernBannerList = bannerList.some((item) => Boolean(item.tokens));
  return isModernBannerList
    ? MARKET_MOBILE_BANNER_MODERN_HEIGHT
    : MARKET_MOBILE_BANNER_LEGACY_HEIGHT;
}

export type IMarketBannerHeaderHeightState = {
  scope: string;
  height: number;
};

export function resolveMarketBannerHeaderHeight({
  current,
  scope,
  isFetched,
  bannerList,
}: {
  current: IMarketBannerHeaderHeightState;
  scope: string;
  isFetched: boolean;
  bannerList: readonly { tokens?: unknown }[];
}): IMarketBannerHeaderHeightState {
  if (isFetched && bannerList.length > 0) {
    const height = getMarketMobileBannerHeaderHeight(bannerList);
    return current.scope === scope && current.height === height
      ? current
      : { scope, height };
  }
  if (current.scope !== scope) {
    return { scope, height: MARKET_MOBILE_BANNER_LEGACY_HEIGHT };
  }
  return current;
}

export type IMarketBannerHeaderDecision = {
  scope: string;
  isDecided: boolean;
  hasBanners: boolean;
};

export function resolveMarketBannerHeaderDecision({
  current,
  scope,
  isFetched,
  bannerCount,
}: {
  current: IMarketBannerHeaderDecision;
  scope: string;
  isFetched: boolean;
  bannerCount: number;
}): IMarketBannerHeaderDecision {
  if (current.scope !== scope) {
    return {
      scope,
      isDecided: isFetched,
      hasBanners: isFetched && bannerCount > 0,
    };
  }
  if (!current.isDecided && isFetched) {
    return { scope, isDecided: true, hasBanners: bannerCount > 0 };
  }
  return current;
}

const MARKET_MOBILE_COMPACT_HEADER_OFFSET =
  MARKET_MOBILE_COMPACT_SECONDARY_HEADER_HEIGHT -
  MARKET_MOBILE_SECONDARY_HEADER_HEIGHT;
const MARKET_MOBILE_EMPTY_CONTENT_OFFSET =
  MARKET_MOBILE_CONTENT_TOP_GAP - MARKET_MOBILE_SECONDARY_HEADER_HEIGHT;

interface IGetMarketEmptyWatchlistContainerPropsParams {
  isNativeAndroid: boolean;
  isWeb: boolean;
}

export function getMarketEmptyWatchlistContainerProps({
  isWeb,
}: IGetMarketEmptyWatchlistContainerPropsParams) {
  return isWeb
    ? ({} as const)
    : ({ y: MARKET_MOBILE_EMPTY_CONTENT_OFFSET } as const);
}

export function getMarketMobileSecondaryHeaderHeight() {
  return MARKET_MOBILE_SECONDARY_HEADER_HEIGHT;
}

export function getMarketNativeCompactListStyle(isCompact: boolean) {
  return isCompact
    ? ({
        transform: [{ translateY: MARKET_MOBILE_COMPACT_HEADER_OFFSET }],
      } as const)
    : ({} as const);
}

// The empty watchlist content sits a fixed distance below the tab bar
// instead of drifting toward the middle of tall windows.
const MARKET_RECOMMEND_WEB_TOP_GAP = 24;

interface IGetMarketRecommendContainerPaddingTopParams {
  isNative: boolean;
}

export function getMarketRecommendContainerPaddingTop({
  isNative,
}: IGetMarketRecommendContainerPaddingTopParams) {
  return isNative ? 0 : MARKET_RECOMMEND_WEB_TOP_GAP;
}

interface IGetMarketWebSecondaryHeaderHeightParams {
  isWatchlistEmpty: boolean;
  showWatchlistSubHeader: boolean;
  showSpotSubHeader: boolean;
  hasSpotSecondaryControls: boolean;
}

export function getMarketWebSecondaryHeaderHeight({
  isWatchlistEmpty,
  showWatchlistSubHeader,
  showSpotSubHeader,
  hasSpotSecondaryControls,
}: IGetMarketWebSecondaryHeaderHeightParams) {
  if (showWatchlistSubHeader && isWatchlistEmpty) {
    return 0;
  }
  if (showSpotSubHeader && !hasSpotSecondaryControls) {
    return MARKET_MOBILE_COMPACT_SECONDARY_HEADER_HEIGHT;
  }
  return MARKET_MOBILE_SECONDARY_HEADER_HEIGHT;
}
