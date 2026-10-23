export const BROWSER_BOTTOM_BAR_HEIGHT = 54;
export const MIN_TOGGLE_BROWSER_VISIBLE_DISTANCE =
  BROWSER_BOTTOM_BAR_HEIGHT * 2;
export const DISPLAY_BOTTOM_BAR_DURATION = 300;
// Mobile browser header (below the safe-area top inset); it collapses fully
// while scrolling down, the address stays visible in the bottom pill.
export const BROWSER_HEADER_HEIGHT = 44;
// Safari-style collapsed address pill shown at the bottom while scrolling.
export const BROWSER_COLLAPSED_PILL_HEIGHT = 30;
// Capsule/circle height of the mobile browser chrome.
export const BROWSER_CHROME_CAPSULE_HEIGHT = 44;
// Side padding shared by the browser header and bottom bar so their edges
// line up.
export const BROWSER_CHROME_SIDE_PADDING = 16;
// The expanded chrome fades out in the first half of a collapse and the
// collapsed address pill fades in during the second half.
export const BROWSER_CHROME_CROSSFADE_POINT = 0.5;
// Horizontal swipe on the address capsule that switches tabs.
export const BROWSER_ADDRESS_SWIPE_DISTANCE = 56;
