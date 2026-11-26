import { createContext } from 'react';

// The part of the fullscreen layer's trailing safe-area inset that no hardware
// covers. iOS reserves the same landscape inset on both sides, though only the
// side with the sensor housing needs it; controls anchored to the trailing edge
// extend into the clear part, as they reach the edge on Android. A leaf module
// so the presentation and the chart controls share it without importing each
// other.
export const TradingViewNativeFullscreenTrailingInsetContext = createContext(0);
