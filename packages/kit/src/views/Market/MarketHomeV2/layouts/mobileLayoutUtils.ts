export const MARKET_MOBILE_SECONDARY_HEADER_HEIGHT = 74;

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
  return isWeb ? ({ paddingTop: '$8' } as const) : ({ y: -25 } as const);
}

export function getMarketMobileSecondaryHeaderHeight() {
  return MARKET_MOBILE_SECONDARY_HEADER_HEIGHT;
}
