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
 * against one sawtooth master clock; the screen wake/sleep vocabulary lives
 * here so every device boots the same way, while press/tap feel stays
 * per-device.
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

/* ---------------------------------------------------------------- *
 * Screen power vocabulary, shared by every device:
 *  - wake: glow rises over 500ms, the panel holds lit-but-empty for a
 *    beat, then content renders in over 720-1100ms (light first, then
 *    pixels, the way real hardware boots)
 *  - sleep: glow and content drop together over 300ms
 * ---------------------------------------------------------------- */

export const WAKE_GLOW_MS = 500;
export const CONTENT_IN_START_MS = 720;
export const CONTENT_IN_END_MS = 1100;
export const SLEEP_MS = 300;

export function screenGlowTrack(sleepStart: number): IKeyframe[] {
  return [
    { t: 0, v: 0, e: easeOutFn },
    { t: WAKE_GLOW_MS, v: 1 },
    { t: sleepStart, v: 1, e: easeInFn },
    { t: sleepStart + SLEEP_MS, v: 0 },
  ];
}

export function screenContentTrack(sleepStart: number): IKeyframe[] {
  return [
    { t: 0, v: 0 },
    { t: CONTENT_IN_START_MS, v: 0, e: easeOutFn },
    { t: CONTENT_IN_END_MS, v: 1 },
    { t: sleepStart, v: 1, e: easeInFn },
    { t: sleepStart + SLEEP_MS, v: 0 },
  ];
}

/**
 * Sawtooth master clock in milliseconds, looping over [0, loopMs). Under
 * reduced motion it holds `restMs` instead, so the device still reads awake
 * and mid-scenario rather than going dark. `startDelayMs` holds the clock
 * at 0 before the first pass, for scenes whose entrance (a separate screen
 * wake) must finish before the loop begins. A `loopMs` of 0 means no loop
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
