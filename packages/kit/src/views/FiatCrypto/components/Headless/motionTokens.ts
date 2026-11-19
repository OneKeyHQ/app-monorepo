import {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';

// Motion hierarchy for the Headless buy flow. Three rules everything follows:
// exits are FASTER than enters (the outgoing block gets out of the way, the
// incoming one arrives into clean space — symmetric fades double-expose at
// the midpoint), anything appearing or leaving DECELERATES (a strong ease-out:
// ease-in delays the first frames, exactly when the eye is on the change),
// and micro changes (row fades, error text) stay subordinate to the
// mode-level motion. On-screen moves (the amount re-centering) use a strong
// ease-in-out.
export const MOTION_ENTER_MS = 175;
export const MOTION_EXIT_MS = 100;
export const MOTION_MICRO_MS = 120;
// Pressing in is the user's own move and may take its time; letting go is
// the system answering, so it snaps back over EXIT ms.
export const MOTION_PRESS_MS = 150;

// Reanimated's Easing members are worklets — .easing() rejects plain JS
// closures in dev builds, so always use these shared instances. The built-in
// quad curves read as sluggish at these short durations; these Bézier curves
// front-load the movement.
export const MOTION_EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const MOTION_EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
// Press feedback: a gentler ease-out, so the press-in is felt rather than
// snapped.
export const MOTION_EASE_PRESS = Easing.bezier(0.25, 0.46, 0.45, 0.94);

// Reduced motion means gentler, not none: every fade below only changes
// opacity, so it keeps playing with the system setting on (ReduceMotion
// .Never). What moves or resizes — the amount gliding, card rows gliding,
// the status badge growing in, the press-in — keeps Reanimated's default
// (ReduceMotion.System) and snaps instead.

// The mode-level blocks (input keypad, review breakdown) and the order
// status block: in over ENTER, out over EXIT.
export const MOTION_BLOCK_ENTERING = FadeIn.duration(MOTION_ENTER_MS)
  .easing(MOTION_EASE_OUT)
  .reduceMotion(ReduceMotion.Never);
export const MOTION_BLOCK_EXITING = FadeOut.duration(MOTION_EXIT_MS)
  .easing(MOTION_EASE_OUT)
  .reduceMotion(ReduceMotion.Never);

// A block of text that swaps in place (the order status): like the text
// below, the newcomer waits for the old block to be gone.
export const MOTION_BLOCK_ENTERING_AFTER_EXIT = FadeIn.duration(MOTION_ENTER_MS)
  .delay(MOTION_EXIT_MS)
  .easing(MOTION_EASE_OUT)
  .reduceMotion(ReduceMotion.Never);

// Small things that swap in a fixed slot (the input step's CTA slot)
// crossfade: in over MICRO, out over EXIT. Shapes blend for a frame at most.
export const MOTION_MICRO_ENTERING = FadeIn.duration(MOTION_MICRO_MS)
  .easing(MOTION_EASE_OUT)
  .reduceMotion(ReduceMotion.Never);
export const MOTION_MICRO_EXITING = FadeOut.duration(MOTION_EXIT_MS)
  .easing(MOTION_EASE_OUT)
  .reduceMotion(ReduceMotion.Never);
// Text is different: two lines cross-fading in one spot (the line under the
// amount), or a new card row fading in while its neighbors glide across its
// spot, double-print for a few frames (seen on device). There the newcomer
// waits EXIT ms — the old line gone, the glide nearly done — then fades in.
export const MOTION_MICRO_ENTERING_AFTER_EXIT = FadeIn.duration(MOTION_MICRO_MS)
  .delay(MOTION_EXIT_MS)
  .easing(MOTION_EASE_OUT)
  .reduceMotion(ReduceMotion.Never);

// Rows inside a card: a leaving row goes at once (it would print over the
// rows gliding into its place), the rest glide, and a new row fades in after
// them (MOTION_MICRO_ENTERING_AFTER_EXIT). One definition for the review and
// order cards.
export const MOTION_ROW_LAYOUT =
  LinearTransition.duration(MOTION_MICRO_MS).easing(MOTION_EASE_IN_OUT);
