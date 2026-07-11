export const MARKET_MOBILE_SECONDARY_HEADER_HEIGHT = 74;

interface IGetMarketEmptyWatchlistContainerPropsParams {
  isNativeAndroid: boolean;
}

export function getMarketEmptyWatchlistContainerProps({
  isNativeAndroid,
}: IGetMarketEmptyWatchlistContainerPropsParams) {
  return isNativeAndroid
    ? ({ paddingTop: '$8' } as const)
    : ({ y: -25 } as const);
}

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
