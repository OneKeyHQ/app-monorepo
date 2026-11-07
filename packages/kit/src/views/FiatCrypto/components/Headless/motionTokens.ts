import { Easing } from 'react-native-reanimated';

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

// Reanimated's Easing members are worklets — .easing() rejects plain JS
// closures in dev builds, so always use these shared instances. The built-in
// quad curves read as sluggish at these short durations; these Bézier curves
// front-load the movement.
export const MOTION_EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const MOTION_EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
