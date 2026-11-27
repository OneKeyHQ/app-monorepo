// How the Swap action button's content changes, shared by the web motion
// (useActionContentMotion in SwapActionsState) and the native one
// (SwapActionContentMotion.native): new content fades in and rises into place,
// and when the fill stays the same the old content leaves upward a little
// quicker.
export const SWAP_ACTION_CONTENT_FADE_MS = 180;
export const SWAP_ACTION_CONTENT_RISE_MS = 260;
export const SWAP_ACTION_CONTENT_RISE_PX = 8;
export const SWAP_ACTION_CONTENT_EXIT_MS = 120;
export const SWAP_ACTION_CONTENT_EXIT_PX = 4;

// Cubic Bézier control points. The fades and the exit use CSS `ease-out`.
export const SWAP_ACTION_CONTENT_FADE_EASING = [0, 0, 0.58, 1] as const;
export const SWAP_ACTION_CONTENT_RISE_EASING = [0.33, 1, 0.68, 1] as const;
