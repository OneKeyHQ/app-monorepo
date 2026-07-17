import { Easing } from 'react-native-reanimated';

// Motion hierarchy for the Headless buy flow. Three rules everything follows:
// exits are FASTER than enters (the outgoing block gets out of the way, the
// incoming one arrives into clean space — symmetric fades double-expose at
// the midpoint), enters DECELERATE (ease-out) while exits ACCELERATE
// (ease-in), and micro changes (row fades, error text) stay subordinate to
// the mode-level motion.
export const MOTION_ENTER_MS = 175;
export const MOTION_EXIT_MS = 100;
export const MOTION_MICRO_MS = 120;

// Reanimated's Easing members are worklets — .easing() rejects plain JS
// closures in dev builds, so always use these shared instances.
export const MOTION_EASE_OUT = Easing.out(Easing.quad);
export const MOTION_EASE_IN = Easing.in(Easing.quad);
export const MOTION_EASE_IN_OUT = Easing.inOut(Easing.quad);
