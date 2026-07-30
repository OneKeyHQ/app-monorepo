import { useEffect, useMemo } from 'react';

import {
  Easing,
  cancelAnimation,
  makeMutable,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { SharedValue } from 'react-native-reanimated';

export type IClassicDeviceButtonKey = 'power' | 'up' | 'down' | 'ok';

/**
 * Animation contract of the code-drawn Classic device, one field per layer of
 * the decomposition: ScreenPower (the glow/content opacity pair) and
 * ButtonPress (one 0..1 value per physical key). Scenes produce this object;
 * ClassicDevice only wires the values onto views - so every scenario shares
 * the same wake/sleep rendering and press feel, and a global tweak lands in
 * exactly one place.
 */
export interface IClassicDeviceAnimation {
  /** 0 dark .. 1 the faint powered-on luminance across the whole glass. */
  screenGlow: Readonly<SharedValue<number>>;
  /** 0 hidden .. 1 shown, opacity of the screenContent node. */
  screenContent: Readonly<SharedValue<number>>;
  /** 0 released .. 1 fully pressed. Keys left out stay released. */
  press?: Partial<
    Record<IClassicDeviceButtonKey, Readonly<SharedValue<number>>>
  >;
}

/** Stand-in for a key a scene does not animate. */
export const PRESS_RELEASED = makeMutable(0);
const SCREEN_ON_VALUE = makeMutable(1);

// Static fallbacks for animation-less usages: a bare shell keeps the screen
// dark (pixel-identical to the verified static device), a shell given static
// screenContent shows it steady-on.
export const CLASSIC_DEVICE_SCREEN_OFF: IClassicDeviceAnimation = {
  screenGlow: PRESS_RELEASED,
  screenContent: PRESS_RELEASED,
};
export const CLASSIC_DEVICE_SCREEN_ON: IClassicDeviceAnimation = {
  screenGlow: SCREEN_ON_VALUE,
  screenContent: SCREEN_ON_VALUE,
};

interface IKeyframe {
  t: number;
  v: number;
  /** Easing of the segment leaving this keyframe (linear when omitted). */
  e?: (u: number) => number;
}

const easeOutFn = Easing.bezierFn(0, 0, 0.58, 1);
const easeInFn = Easing.bezierFn(0.42, 0, 1, 1);

// Every track of a scene is evaluated against one master clock, so tracks can
// never drift apart under infinite repeat (three independent withRepeat loops
// would).
function trackAt(t: number, kfs: IKeyframe[]): number {
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
 * Shared scene vocabulary. Every scene is built from the same three
 * primitives, parameterized only by its own schedule:
 *  - screen wake: glow rises over 280ms, content fades in 240-700ms
 *  - screen sleep: glow and content drop together over 300ms
 *  - key press: 100ms down / 150ms hold / 100ms up (the envelope of the
 *    original Lottie files)
 * ---------------------------------------------------------------- */

const WAKE_GLOW_MS = 280;
const CONTENT_IN_START_MS = 240;
const CONTENT_IN_END_MS = 700;
const SLEEP_MS = 300;
const PRESS_DOWN_MS = 100;
const PRESS_HOLD_MS = 150;
const PRESS_UP_MS = 100;
/** Fills/state changes land mid-hold, like the Lottie's slot swaps. */
const PRESS_ACT_OFFSET_MS = PRESS_DOWN_MS + PRESS_HOLD_MS / 2;

function screenGlowTrack(sleepStart: number): IKeyframe[] {
  return [
    { t: 0, v: 0, e: easeOutFn },
    { t: WAKE_GLOW_MS, v: 1 },
    { t: sleepStart, v: 1, e: easeInFn },
    { t: sleepStart + SLEEP_MS, v: 0 },
  ];
}

function screenContentTrack(sleepStart: number): IKeyframe[] {
  return [
    { t: 0, v: 0 },
    { t: CONTENT_IN_START_MS, v: 0, e: easeOutFn },
    { t: CONTENT_IN_END_MS, v: 1 },
    { t: sleepStart, v: 1, e: easeInFn },
    { t: sleepStart + SLEEP_MS, v: 0 },
  ];
}

function pressPulsesTrack(startTimes: number[]): IKeyframe[] {
  const kfs: IKeyframe[] = [{ t: 0, v: 0 }];
  for (const s of startTimes) {
    kfs.push(
      { t: s, v: 0, e: easeOutFn },
      { t: s + PRESS_DOWN_MS, v: 1 },
      { t: s + PRESS_DOWN_MS + PRESS_HOLD_MS, v: 1, e: easeInFn },
      { t: s + PRESS_DOWN_MS + PRESS_HOLD_MS + PRESS_UP_MS, v: 0 },
    );
  }
  return kfs;
}

interface ISceneTracks {
  loopMs: number;
  /** Clock position held when the viewer prefers reduced motion. */
  restMs: number;
  glow: IKeyframe[];
  content: IKeyframe[];
  ok: IKeyframe[];
}

function sceneTracks(
  loopMs: number,
  restMs: number,
  sleepAtMs: number,
  pressStartsMs: number[],
): ISceneTracks {
  return {
    loopMs,
    restMs,
    glow: screenGlowTrack(sleepAtMs),
    content: screenContentTrack(sleepAtMs),
    ok: pressPulsesTrack(pressStartsMs),
  };
}

/**
 * Sawtooth master clock in milliseconds, looping over [0, loopMs). Under
 * reduced motion it holds `restMs` instead, so the device still reads awake
 * and mid-scenario rather than going dark.
 */
function useSceneClock(loopMs: number, restMs: number): SharedValue<number> {
  const clock = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (reducedMotion) {
      clock.value = restMs;
      return undefined;
    }
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(loopMs, { duration: loopMs, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(clock);
  }, [clock, loopMs, restMs, reducedMotion]);
  return clock;
}

/** Assembles one scene's tracks into the device contract. */
function useSceneAnimation(scene: ISceneTracks): {
  animation: IClassicDeviceAnimation;
  clock: SharedValue<number>;
} {
  const clock = useSceneClock(scene.loopMs, scene.restMs);
  const screenGlow = useDerivedValue(() => trackAt(clock.value, scene.glow));
  const screenContent = useDerivedValue(() =>
    trackAt(clock.value, scene.content),
  );
  const okPress = useDerivedValue(() => trackAt(clock.value, scene.ok));
  const animation = useMemo(
    () => ({ screenGlow, screenContent, press: { ok: okPress } }),
    [screenGlow, screenContent, okPress],
  );
  return { animation, clock };
}

/* ---------------------------------------------------------------- *
 * Confirm, 3s loop: wake -> skeleton fades in -> one OK press -> sleep.
 * ---------------------------------------------------------------- */

const CONFIRM = sceneTracks(3000, 900, 2100, [1100]);

export function useConfirmOnClassicAnimation(): IClassicDeviceAnimation {
  return useSceneAnimation(CONFIRM).animation;
}

/* ---------------------------------------------------------------- *
 * Character-entry scenes (Enter PIN / Enter Passphrase - the original
 * Lottie files are frame-identical too), 5.6s loop: wake -> empty row fades in
 * -> six OK presses enter characters (each at mid-hold) -> the check appears at
 * the cursor -> one final OK press confirms -> sleep. Seven pulses total,
 * exactly like the Lottie files (their unexplained 7th press was this confirm).
 * ---------------------------------------------------------------- */

const ENTRY_PRESS_START_MS = 900;
const ENTRY_PRESS_STEP_MS = 500;
const ENTRY_FILL_COUNT = 6;
const ENTRY = sceneTracks(
  5600,
  // Rest on the completed row: everything entered, the confirm press over.
  4400,
  4700,
  Array.from(
    { length: ENTRY_FILL_COUNT + 1 },
    (_, i) => ENTRY_PRESS_START_MS + i * ENTRY_PRESS_STEP_MS,
  ),
);

/** How many characters are entered at clock time t (fills land mid-hold). */
function entryEnteredAt(t: number): number {
  'worklet';

  let entered = 0;
  for (let i = 0; i < ENTRY_FILL_COUNT; i += 1) {
    if (
      t >=
      ENTRY_PRESS_START_MS + i * ENTRY_PRESS_STEP_MS + PRESS_ACT_OFFSET_MS
    ) {
      entered += 1;
    }
  }
  return entered;
}

export function useEntryOnClassicAnimation(): {
  animation: IClassicDeviceAnimation;
  /** Characters entered so far, for the screen content to follow. */
  entered: Readonly<SharedValue<number>>;
  fillCount: number;
} {
  const { animation, clock } = useSceneAnimation(ENTRY);
  const entered = useDerivedValue(() => entryEnteredAt(clock.value));
  return useMemo(
    () => ({ animation, entered, fillCount: ENTRY_FILL_COUNT }),
    [animation, entered],
  );
}
