export const MARKET_MOBILE_SECONDARY_HEADER_HEIGHT = 74;
export const MARKET_MOBILE_COLUMN_HEADER_HEIGHT = 32;
export const MARKET_MOBILE_CONTENT_TOP_GAP = 16;

const MARKET_MOBILE_COMPACT_HEADER_OFFSET =
  MARKET_MOBILE_COLUMN_HEADER_HEIGHT - MARKET_MOBILE_SECONDARY_HEADER_HEIGHT;
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

interface IGetMarketRecommendContainerPaddingTopParams {
  isNative: boolean;
  windowHeight: number;
}

export function getMarketRecommendContainerPaddingTop({
  isNative,
  windowHeight,
}: IGetMarketRecommendContainerPaddingTopParams) {
  return isNative ? 0 : Math.max(0, (windowHeight - 800) * 0.5);
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
    return MARKET_MOBILE_COLUMN_HEADER_HEIGHT;
  }
  return MARKET_MOBILE_SECONDARY_HEADER_HEIGHT;
}
