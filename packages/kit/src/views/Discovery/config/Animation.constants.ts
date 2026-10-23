export const BROWSER_BOTTOM_BAR_HEIGHT = 54;
export const MIN_TOGGLE_BROWSER_VISIBLE_DISTANCE =
  BROWSER_BOTTOM_BAR_HEIGHT * 2;
export const DISPLAY_BOTTOM_BAR_DURATION = 180;
export const MAX_OPACITY_BOTTOM_BAR = 1;
export const MIN_OPACITY_BOTTOM_BAR = 0;
// Mobile browser header (below the safe-area top inset). While scrolling down
// it collapses: fully on iOS (the address lives in the bottom bar, like
// Safari), into a compact domain strip on Android.
export const BROWSER_HEADER_HEIGHT = 52;
export const BROWSER_HEADER_HEIGHT_ANDROID = 56;
export const BROWSER_HEADER_COLLAPSED_HEIGHT = 0;
export const BROWSER_HEADER_COLLAPSED_HEIGHT_ANDROID = 24;
// Safari-style collapsed address pill shown at the bottom while scrolling.
export const BROWSER_COLLAPSED_PILL_HEIGHT = 30;
// Glass capsule/circle height used by the iOS browser chrome.
export const BROWSER_CHROME_CAPSULE_HEIGHT = 44;
// The header content fades out in the first part of the collapse and the
// compact domain strip fades in during the rest, so they never overlap.
export const BROWSER_HEADER_CROSSFADE_POINT = 0.5;
