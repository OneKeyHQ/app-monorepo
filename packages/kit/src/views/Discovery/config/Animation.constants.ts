// Scroll distance in one direction before the browser chrome collapses or
// expands, so small scroll jitters don't toggle it.
export const MIN_TOGGLE_BROWSER_VISIBLE_DISTANCE = 108;
// Mobile browser chrome collapse/expand (spring settle time).
export const DISPLAY_BOTTOM_BAR_DURATION = 450;
// Mobile browser header (below the safe-area top inset); it collapses fully
// while scrolling down, the address stays visible in the bottom pill.
export const BROWSER_HEADER_HEIGHT = 46;
// Safari-style collapsed address pill shown at the bottom while scrolling.
export const BROWSER_COLLAPSED_PILL_HEIGHT = 30;
// Capsule/circle height of the mobile browser chrome.
export const BROWSER_CHROME_CAPSULE_HEIGHT = 46;
// Side padding of the mobile browser bottom bar. Like Safari, the bar is
// inset well clear of the screen corners.
export const BROWSER_CHROME_SIDE_PADDING = 24;
// The expanded chrome fades out in the first half of a collapse and the
// collapsed address pill fades in during the second half.
export const BROWSER_CHROME_CROSSFADE_POINT = 0.5;
