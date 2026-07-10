export const MARKET_MOBILE_SECONDARY_HEADER_HEIGHT = 74;

interface IGetMarketMobileSecondaryHeaderHeightParams {
  isNativeAndroid: boolean;
  isWatchlistEmpty: boolean;
  showWatchlistSubHeader: boolean;
}

export function getMarketMobileSecondaryHeaderHeight({
  isNativeAndroid,
  isWatchlistEmpty,
  showWatchlistSubHeader,
}: IGetMarketMobileSecondaryHeaderHeightParams) {
  if (isNativeAndroid && showWatchlistSubHeader && isWatchlistEmpty) {
    return 0;
  }
  return MARKET_MOBILE_SECONDARY_HEADER_HEIGHT;
}
