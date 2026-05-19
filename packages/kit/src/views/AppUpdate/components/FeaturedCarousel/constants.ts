/**
 * Visual tuning. All values are starting points — adjust on real device first,
 * not in simulator (spring perception differs).
 *
 * Order of impact when tuning:
 *   1. HEIGHT_SPRING — most visible "premium" feel
 *   2. SLIDE_TRANSLATE_FACTOR — how much adjacent slide peeks during transition
 *   3. CONTENT_SPRING — content settle speed
 *   4. OPACITY_FALLOFF — crossfade aggressiveness
 */

export const MEDIA_HEIGHT = 240;

export const SLIDE_TRANSLATE_FACTOR = 0.92; // adjacent slide offset = slideWidth * 0.92
export const OPACITY_FALLOFF = 1.15; // |i - progress| * 1.15 → opacity falls faster than position
export const TAP_JUMP_DISTANCE = 40; // px offset for tap-jump enter/exit slides

export const CONTENT_SPRING_CONFIG = {
  stiffness: 220,
  damping: 22,
  mass: 1,
} as const;

export const HEIGHT_SPRING_CONFIG = {
  stiffness: 130,
  damping: 18,
  mass: 1,
  overshootClamping: false, // allow ~3% overshoot
} as const;

export const HEIGHT_SPRING_DELAY_MS = 50;
export const TAP_JUMP_DURATION_MS = 180;
export const TAP_JUMP_NEW_SLIDE_DELAY_MS = 80;

// Pan gesture activation thresholds — keep in sync with sheet drag
export const PAN_ACTIVE_OFFSET_X: [number, number] = [-10, 10];
export const PAN_FAIL_OFFSET_Y: [number, number] = [-15, 15];
