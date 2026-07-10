export const MARKET_MOBILE_SECONDARY_HEADER_HEIGHT = 74;
export const MARKET_MOBILE_COLUMN_HEADER_HEIGHT = 32;

interface IGetMarketEmptyWatchlistContainerPropsParams {
  isNativeAndroid: boolean;
  isWeb: boolean;
}

export function getMarketEmptyWatchlistContainerProps({
  isNativeAndroid,
  isWeb,
}: IGetMarketEmptyWatchlistContainerPropsParams) {
  if (isNativeAndroid) {
    return { paddingTop: '$8' } as const;
  }
  return isWeb ? ({} as const) : ({ y: -25 } as const);
}

export function getMarketMobileSecondaryHeaderHeight() {
  return MARKET_MOBILE_SECONDARY_HEADER_HEIGHT;
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
