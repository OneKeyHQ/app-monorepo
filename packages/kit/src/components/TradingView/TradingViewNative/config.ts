import { TRADING_VIEW_NATIVE_LARGE_SCREEN_MIN_WIDTH } from './chartConstants';

import type { ITradingViewNativeInitialRightOffset } from './types';

export const TRADING_VIEW_NATIVE_DEFAULT_INITIAL_RIGHT_OFFSET = {
  largeScreen: {
    type: 'chartWidthPercentage',
    value: 5,
  },
  largeScreenMinWidth: TRADING_VIEW_NATIVE_LARGE_SCREEN_MIN_WIDTH,
  smallScreen: {
    type: 'pointCount',
    value: 2,
  },
} as const;

export function getTradingViewNativeDefaultInitialRightOffset(
  width: number,
): ITradingViewNativeInitialRightOffset {
  'worklet';

  return width >=
    TRADING_VIEW_NATIVE_DEFAULT_INITIAL_RIGHT_OFFSET.largeScreenMinWidth
    ? TRADING_VIEW_NATIVE_DEFAULT_INITIAL_RIGHT_OFFSET.largeScreen
    : TRADING_VIEW_NATIVE_DEFAULT_INITIAL_RIGHT_OFFSET.smallScreen;
}
