import { Easing, makeMutable } from 'react-native-reanimated';

import { easeInFn, easeOutFn } from '../deviceScene';

import type { IKeyframe } from '../deviceScene';
import type { SharedValue } from 'react-native-reanimated';

/**
 * Animation contract of the code-drawn Slate device: one track, the screen
 * content's opacity. Per the design ruling the glass itself stays pure
 * black at all times - there is no panel luminance layer, and "waking" is
 * nothing more than content rendering in (over pure black an opacity ramp
 * IS a luminance ramp). The device has no face keys, so any future tap
 * feedback belongs inside scene screen content.
 *
 * The lit-to-lit swap lives here too - content fades off the black glass,
 * the next scene's content renders in - through which later scenes change
 * what the glass shows. Unlike the sibling devices' looping reels there
 * is no per-scene wake or sleep.
 */
export interface ISlateDeviceAnimation {
  /** 0 hidden .. 1 shown, opacity of the screenContent node. */
  screenContent: Readonly<SharedValue<number>>;
}

const VALUE_OFF = makeMutable(0);
const VALUE_ON = makeMutable(1);

// Static fallbacks for animation-less usages, mirroring the sibling statics.
export const SLATE_DEVICE_SCREEN_OFF: ISlateDeviceAnimation = {
  screenContent: VALUE_OFF,
};
export const SLATE_DEVICE_SCREEN_ON: ISlateDeviceAnimation = {
  screenContent: VALUE_ON,
};

/* ------------------------- screen power ------------------------- *
 * Timing of a scene's content over the always-black glass. The opacity
 * itself is one resident shared value owned by SlateDevice - scheduled
 * there and outliving scene mounts, so an entrance cannot be lost to a
 * busy mount frame - and scenes receive it ready-made. Anything a caller
 * must sequence between two scenes (the stage's word swap, say) queues
 * after SCREEN_SWAP_MS. */

/** Content-in: the whole of an entry. */
export const CONTENT_IN_MS = 760;
/**
 * Slow-start curve for the content-in, and the reason it is not the
 * shared ease-out: opacity over black composites in sRGB, where half
 * opacity already reads about three quarters as bright, so an ease-out
 * ramp is perceptually over before it is numerically half done — the
 * screen looks like it snapped on. Starting slow spends the ramp where
 * the eye can still see it change.
 */
export const contentInEase = Easing.bezierFn(0.6, 0, 0.7, 1);
/** Content-out; SlateDevice keeps the outgoing scene mounted this long. */
export const SCREEN_SWAP_OUT_MS = 300;
/** A full lit-to-lit handover, out then in — the beat callers queue after. */
export const SCREEN_SWAP_MS = SCREEN_SWAP_OUT_MS + CONTENT_IN_MS;

/* ------------------------- enter PIN ------------------------- *
 * The keyboard sheen and the entry dots. One soft light crosses the keypad
 * from its top-left to its bottom-right corner - every key pulses as the
 * wavefront passes, staggered by grid diagonal, which reads as a single
 * gradient light in motion - then the four entry dots land one by one.
 * Deliberately no key ever lights alone: the scene shows that entry
 * happens on the device without performing an actual PIN. */

const PIN_SWEEP_START_MS = 300;
/** Wavefront stagger per grid diagonal (col + row, 0..5). */
const PIN_SWEEP_STEP_MS = 140;
const PIN_SWEEP_PULSE_MS = 500;
const PIN_DOT_START_MS = 1800;
const PIN_DOT_STEP_MS = 300;
const PIN_DOT_IN_MS = 180;
const PIN_DOTS_OUT_START_MS = 4000;
const PIN_DOTS_OUT_MS = 300;
/** Scene loop for the registry; rest = all four dots shown, keyboard quiet. */
export const PIN_LOOP = { loopMs: 4800, restMs: 3200 };

/** One pass of the traveling sheen over one element: a soft pulse. */
function sheenPulseTrack(startMs: number, pulseMs: number): IKeyframe[] {
  return [
    { t: 0, v: 0 },
    { t: startMs, v: 0, e: easeOutFn },
    { t: startMs + pulseMs / 2, v: 1, e: easeInFn },
    { t: startMs + pulseMs, v: 0 },
  ];
}

/** Sheen opacity of the key at grid diagonal `diagonal` (col + row). */
function pinKeySheenTrack(diagonal: number): IKeyframe[] {
  return sheenPulseTrack(
    PIN_SWEEP_START_MS + diagonal * PIN_SWEEP_STEP_MS,
    PIN_SWEEP_PULSE_MS,
  );
}

/** Opacity of entry dot `index`: dots land in order, all leave together. */
function pinDotTrack(index: number): IKeyframe[] {
  const landAt = PIN_DOT_START_MS + index * PIN_DOT_STEP_MS;
  return [
    { t: 0, v: 0 },
    { t: landAt, v: 0, e: easeOutFn },
    { t: landAt + PIN_DOT_IN_MS, v: 1 },
    { t: PIN_DOTS_OUT_START_MS, v: 1, e: easeInFn },
    { t: PIN_DOTS_OUT_START_MS + PIN_DOTS_OUT_MS, v: 0 },
  ];
}

/* The scene's tracks are pure functions of the constants above and there
 * are only a handful of each, so they are built once here rather than per
 * key and per dot on every mount. Indexed by grid diagonal and by landing
 * order respectively. */
export const PIN_SHEEN_TRACKS = [0, 1, 2, 3, 4, 5].map(pinKeySheenTrack);
export const PIN_DOT_TRACKS = [0, 1, 2, 3].map(pinDotTrack);

/* ------------------------- confirm ------------------------- *
 * The one gradient light crossing the glass, top-left corner to
 * bottom-right corner. It lives on the screen, not on the content: the
 * skeleton stays a still and the band passes over it, the way a
 * reflection travels across glass. */

const CONFIRM_SWEEP_START_MS = 300;
/** Corner-to-corner travel of the band. */
const CONFIRM_SWEEP_MS = 900;
/** Scene loop for the registry; rest = the plain still, the light gone. */
export const CONFIRM_LOOP = { loopMs: 3200, restMs: 2000 };

/**
 * Travel of the light: 0 parked off past the top-left corner, 1 off past
 * the bottom-right, linear in between.
 */
export const CONFIRM_SWEEP_TRACK: IKeyframe[] = [
  { t: 0, v: 0 },
  { t: CONFIRM_SWEEP_START_MS, v: 0 },
  { t: CONFIRM_SWEEP_START_MS + CONFIRM_SWEEP_MS, v: 1 },
];
