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

/* ------------------- the traveling glass light ------------------- *
 * One gradient band crossing a region top-left corner to bottom-right
 * corner, linear: 0 parked off past one corner, 1 off past the other.
 * It lives on the glass, not on the content — a still stays a still and
 * the band passes over it, the way a reflection travels. Confirm plays
 * it across the whole screen; enterPassphrase plays it clipped inside
 * the keyboard panel (GlassSweep in ./scenes.tsx). */

/** Every scene's light holds this long before it starts to move. */
const LIGHT_START_MS = 300;
/** Corner-to-corner travel of the band. */
const SWEEP_TRAVEL_MS = 900;
export const GLASS_SWEEP_TRACK: IKeyframe[] = [
  { t: 0, v: 0 },
  { t: LIGHT_START_MS, v: 0 },
  { t: LIGHT_START_MS + SWEEP_TRAVEL_MS, v: 1 },
];

/* ------------------ entry scenes (PIN / passphrase) ------------------ *
 * The PIN keypad plays a traveling sheen: every key pulses as a
 * wavefront passes, staggered by grid diagonal (col + row), which reads
 * as a single gradient light in motion. The passphrase keyboard plays
 * the glass sweep above, clipped to its panel. Then both land their
 * entered marks one by one — growing from the center, each landing
 * nudging the earlier marks half a slot leftward so the cluster stays
 * centered until it settles on the full row's natural layout.
 * Deliberately no key ever lights alone: the scenes show that entry
 * happens on the device without performing an actual secret. */

/** PIN wavefront stagger per grid diagonal. */
const SHEEN_STEP_MS = 140;
const SHEEN_PULSE_MS = 500;
const MARK_STEP_MS = 300;
const MARK_IN_MS = 180;
const MARKS_OUT_MS = 300;
/** Complete row held before the marks leave together. */
const MARKS_HOLD_MS = 1120;
/** Quiet beat after the marks leave, closing the loop. */
const LOOP_TAIL_MS = 500;
/** The reduced-motion rest sits this far before the marks leave. */
const REST_LEAD_MS = 800;
/** Half a marks-row slot (disc 5.5 + gap 7.5), the nudge per landing. */
const MARK_HALF_STEP = 6.5;

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
function keySheenTrack(diagonal: number): IKeyframe[] {
  return sheenPulseTrack(
    LIGHT_START_MS + diagonal * SHEEN_STEP_MS,
    SHEEN_PULSE_MS,
  );
}

/** Opacity of entered mark `index`: marks land in order, leave together. */
function entryMarkTrack(
  markStartMs: number,
  marksOutStartMs: number,
  index: number,
): IKeyframe[] {
  const landAt = markStartMs + index * MARK_STEP_MS;
  return [
    { t: 0, v: 0 },
    { t: landAt, v: 0, e: easeOutFn },
    { t: landAt + MARK_IN_MS, v: 1 },
    { t: marksOutStartMs, v: 1, e: easeInFn },
    { t: marksOutStartMs + MARKS_OUT_MS, v: 0 },
  ];
}

/**
 * TranslateX of mark `index`, over its final layout slot in the full
 * centered row: a cluster of k marks sits (marks - k) half-slots right
 * of that, so every later landing eases the mark half a slot leftward,
 * reaching 0 as the row completes.
 */
function entryMarkShiftTrack(
  markStartMs: number,
  marks: number,
  index: number,
): IKeyframe[] {
  const kfs: IKeyframe[] = [{ t: 0, v: (marks - index - 1) * MARK_HALF_STEP }];
  for (let later = index + 1; later < marks; later += 1) {
    const landAt = markStartMs + later * MARK_STEP_MS;
    kfs.push(
      { t: landAt, v: (marks - later) * MARK_HALF_STEP, e: easeOutFn },
      { t: landAt + MARK_IN_MS, v: (marks - later - 1) * MARK_HALF_STEP },
    );
  }
  return kfs;
}

/**
 * An entry scene's whole schedule from its light phase and mark count:
 * the marks start a beat after the light has passed, hold the complete
 * row, leave together, and the loop closes a quiet tail later. Rest is
 * the completed row, keyboard quiet. Tracks are pure functions of the
 * constants and there are only a handful, so they are built once here
 * rather than per mark on every mount; indexed by landing order.
 */
function entrySchedule(lightMs: number, marks: number) {
  const markStartMs = LIGHT_START_MS + lightMs + MARK_STEP_MS;
  const marksOutStartMs =
    markStartMs + (marks - 1) * MARK_STEP_MS + MARK_IN_MS + MARKS_HOLD_MS;
  return {
    loop: {
      loopMs: marksOutStartMs + MARKS_OUT_MS + LOOP_TAIL_MS,
      restMs: marksOutStartMs - REST_LEAD_MS,
    },
    markTracks: Array.from({ length: marks }, (_, i) =>
      entryMarkTrack(markStartMs, marksOutStartMs, i),
    ),
    markShiftTracks: Array.from({ length: marks }, (_, i) =>
      entryMarkShiftTrack(markStartMs, marks, i),
    ),
  };
}

/* enterPin: 3x4 keypad wavefront (diagonals 0..5), four entered marks. */
const PIN_LIGHT_MS = 5 * SHEEN_STEP_MS + SHEEN_PULSE_MS;
const PIN_ENTRY = entrySchedule(PIN_LIGHT_MS, 4);
/** Scene loop for the registry (4800ms, resting on the complete row). */
export const PIN_LOOP = PIN_ENTRY.loop;
export const PIN_SHEEN_TRACKS = [0, 1, 2, 3, 4, 5].map(keySheenTrack);
export const PIN_DOT_TRACKS = PIN_ENTRY.markTracks;
export const PIN_DOT_SHIFT_TRACKS = PIN_ENTRY.markShiftTracks;

/* enterPassphrase: the panel sweep, six entered marks. */
const PASSPHRASE_ENTRY = entrySchedule(SWEEP_TRAVEL_MS, 6);
/** Scene loop for the registry (5100ms, resting on the complete row). */
export const PASSPHRASE_LOOP = PASSPHRASE_ENTRY.loop;
export const PASSPHRASE_DOT_TRACKS = PASSPHRASE_ENTRY.markTracks;
export const PASSPHRASE_DOT_SHIFT_TRACKS = PASSPHRASE_ENTRY.markShiftTracks;

/* ------------------------- confirm ------------------------- *
 * The glass sweep across the whole screen, over the still skeleton. */

/** Scene loop for the registry; rest = the plain still, the light gone. */
export const CONFIRM_LOOP = { loopMs: 3200, restMs: 2000 };
