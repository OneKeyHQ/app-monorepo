import { useEffect } from 'react';

import {
  Easing,
  cancelAnimation,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { SharedValue } from 'react-native-reanimated';

/**
 * Shared scene machinery of the code-drawn hardware devices (ClassicDevice,
 * ProDevice, SlateDevice). A scene is a set of keyframe tracks evaluated
 * against one sawtooth master clock, and every device's screen runs the
 * presence vocabulary below: the glass shows nothing but content, so
 * "lighting up" is content rendering in. Press/tap feel stays per-device.
 */

export interface IKeyframe {
  t: number;
  v: number;
  /** Easing of the segment leaving this keyframe (linear when omitted). */
  e?: (u: number) => number;
}

export const easeOutFn = Easing.bezierFn(0, 0, 0.58, 1);
export const easeInFn = Easing.bezierFn(0.42, 0, 1, 1);

// Every track of a scene is evaluated against one master clock, so tracks can
// never drift apart under infinite repeat (independent withRepeat loops would).
export function trackAt(t: number, kfs: IKeyframe[]): number {
  'worklet';

  if (t <= kfs[0].t) return kfs[0].v;
  for (let i = 0; i < kfs.length - 1; i += 1) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (t >= a.t && t < b.t) {
      const u = (t - a.t) / (b.t - a.t);
      return a.v + (b.v - a.v) * (a.e ? a.e(u) : u);
    }
  }
  return kfs[kfs.length - 1].v;
}

/**
 * Sawtooth master clock in milliseconds, looping over [0, loopMs). Under
 * reduced motion it holds `restMs` instead, so the device still reads awake
 * and mid-scenario rather than going dark. `startDelayMs` holds the clock
 * at 0 before the first pass, for scenes whose entrance (the content-in)
 * must finish before the loop begins. A `loopMs` of 0 means no loop
 * at all: the clock rests at 0, so still scenes share the machinery.
 */
export function useSceneClock(
  loopMs: number,
  restMs: number,
  startDelayMs = 0,
): SharedValue<number> {
  const clock = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!loopMs || reducedMotion) {
      clock.value = reducedMotion ? restMs : 0;
      return undefined;
    }
    clock.value = 0;
    const loop = withRepeat(
      withTiming(loopMs, { duration: loopMs, easing: Easing.linear }),
      -1,
      false,
    );
    clock.value = startDelayMs > 0 ? withDelay(startDelayMs, loop) : loop;
    return () => cancelAnimation(clock);
  }, [clock, loopMs, restMs, reducedMotion, startDelayMs]);
  return clock;
}

/* ---------------------------------------------------------------- *
 * Presence vocabulary, shared by every replica. The screens have no wake
 * or sleep: the glass shows nothing but content, so "lighting up" IS
 * content rendering in, a scene stays lit for as long as it is on, and a
 * scene change is a lit-to-lit handover. (The Classic folds its faint
 * panel glow into the same opacity — the lit look, without a wake beat —
 * and keeps its seven-press schedule with its device.) The schedules'
 * generators and shared constants live here; each device's animation.ts
 * pins its own screen metrics (mark sizes, counts) into them.
 * ---------------------------------------------------------------- */

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
/** Content-out; the device keeps the outgoing scene mounted this long. */
export const SCREEN_SWAP_OUT_MS = 300;
/** A full lit-to-lit handover, out then in — the beat callers queue after. */
export const SCREEN_SWAP_MS = SCREEN_SWAP_OUT_MS + CONTENT_IN_MS;

/* ------------------- the traveling glass light ------------------- *
 * One gradient band crossing a region top-left corner to bottom-right
 * corner, linear: 0 parked off past one corner, 1 off past the other.
 * It lives on the glass, not on the content — a still stays a still and
 * the band passes over it, the way a reflection travels. Confirm plays
 * it across the whole screen on every device; enterPassphrase plays it
 * over the keyboard (clipped to the Slate's panel box, under the Pro's
 * gap grille - the Classic's entry scenes press keys instead). */

/** Every scene's light holds this long before it starts to move. */
const LIGHT_START_MS = 300;
/** Corner-to-corner travel of the band. */
export const SWEEP_TRAVEL_MS = 900;
export const GLASS_SWEEP_TRACK: IKeyframe[] = [
  { t: 0, v: 0 },
  { t: LIGHT_START_MS, v: 0 },
  { t: LIGHT_START_MS + SWEEP_TRAVEL_MS, v: 1 },
];

/* ------------------ entry scenes (PIN / passphrase) ------------------ *
 * The PIN keypads play a traveling sheen: every key pulses as a
 * wavefront passes, staggered by grid diagonal (col + row), which reads
 * as a single gradient light in motion. The passphrase keyboards play
 * the glass sweep above. Then both land their entered marks one by one.
 * Deliberately no key ever lights alone: the scenes show that entry
 * happens on the device without performing an actual secret. */

/** PIN wavefront stagger per grid diagonal. */
const SHEEN_STEP_MS = 140;
const SHEEN_PULSE_MS = 500;
export const MARK_STEP_MS = 300;
const MARK_IN_MS = 180;
export const MARKS_OUT_MS = 300;
/** Complete row held before the marks leave together. */
const MARKS_HOLD_MS = 1120;
/** Quiet beat after the marks leave, closing the loop. */
const LOOP_TAIL_MS = 500;
/** The reduced-motion rest sits this far before the marks leave. */
const REST_LEAD_MS = 800;

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
 * reaching 0 as the row completes. `markHalfStep` is half the row's
 * slot pitch (disc + gap), a per-device metric.
 */
function entryMarkShiftTrack(
  markStartMs: number,
  marks: number,
  markHalfStep: number,
  index: number,
): IKeyframe[] {
  const kfs: IKeyframe[] = [{ t: 0, v: (marks - index - 1) * markHalfStep }];
  for (let later = index + 1; later < marks; later += 1) {
    const landAt = markStartMs + later * MARK_STEP_MS;
    kfs.push(
      { t: landAt, v: (marks - later) * markHalfStep, e: easeOutFn },
      { t: landAt + MARK_IN_MS, v: (marks - later - 1) * markHalfStep },
    );
  }
  return kfs;
}

/**
 * An entry scene's whole schedule from its light phase, mark count and
 * mark metrics: the marks start a beat after the light has passed, hold
 * the complete row, leave together, and the loop closes a quiet tail
 * later. Rest is the completed row, keyboard quiet. Tracks are pure
 * functions of the constants and there are only a handful, so each
 * device builds them once at module scope rather than per mark on every
 * mount; indexed by landing order. The mark times come back too, for
 * anything that follows the landings (the Pro's length counter).
 */
export function entrySchedule(
  lightMs: number,
  marks: number,
  markHalfStep: number,
) {
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
      entryMarkShiftTrack(markStartMs, marks, markHalfStep, i),
    ),
    markStartMs,
    marksOutStartMs,
  };
}

/* Both PIN pads are the same 3x4 grid, so the wavefront is shared too:
 * diagonals 0..5, light over in PIN_LIGHT_MS. */
export const PIN_LIGHT_MS = 5 * SHEEN_STEP_MS + SHEEN_PULSE_MS;
export const PIN_SHEEN_TRACKS = [0, 1, 2, 3, 4, 5].map(keySheenTrack);

/* ------------------------- confirm ------------------------- *
 * The glass sweep across the whole screen, over the still skeleton.
 * Rest = the plain still, the light gone. Same beat on every device. */
export const CONFIRM_LOOP = { loopMs: 3200, restMs: 2000 };
