import { createContext } from 'react';

// The part of the fullscreen layer's trailing safe-area inset that no hardware
// covers. iOS reserves the same landscape inset on both sides, though only the
// side with the sensor housing needs it; controls anchored to the trailing edge
// extend into the clear part, as they reach the edge on Android. A leaf module
// so the presentation and the chart controls share it without importing each
// other.
export const TradingViewNativeFullscreenTrailingInsetContext = createContext(0);

// The indicator rail and the exit control above it stop this far short of the
// clear inset, so they stay aligned in one column a little off the screen edge.
export const TRADING_VIEW_NATIVE_FULLSCREEN_TRAILING_EDGE_GAP = 8;

export function getTradingViewNativeFullscreenTrailingReach(
  clearTrailingInset: number,
) {
  return Math.max(
    clearTrailingInset - TRADING_VIEW_NATIVE_FULLSCREEN_TRAILING_EDGE_GAP,
    0,
  );
}
