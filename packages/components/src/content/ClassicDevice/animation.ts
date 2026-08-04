import { useMemo } from 'react';

import { makeMutable, useDerivedValue } from 'react-native-reanimated';

import {
  easeInFn,
  easeOutFn,
  screenContentTrack,
  screenGlowTrack,
  trackAt,
  useSceneClock,
} from '../deviceScene';

import type { IKeyframe } from '../deviceScene';
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

/* ---------------------------------------------------------------- *
 * Classic scene vocabulary. The screen wake/sleep tracks and the master
 * clock live in ../deviceScene (shared with ProDevice); this file adds the
 * physical-key press envelope and the Classic schedules:
 *  - key press: 100ms down / 150ms hold / 100ms up (the envelope of the
 *    original Lottie files)
 * ---------------------------------------------------------------- */

const PRESS_DOWN_MS = 100;
const PRESS_HOLD_MS = 150;
const PRESS_UP_MS = 100;
/** Fills/state changes land mid-hold, like the Lottie's slot swaps. */
const PRESS_ACT_OFFSET_MS = PRESS_DOWN_MS + PRESS_HOLD_MS / 2;

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
 * Confirm, 3.2s loop: wake -> skeleton fades in -> one OK press -> sleep.
 * ---------------------------------------------------------------- */

const CONFIRM = sceneTracks(3200, 1200, 2300, [1450]);

export function useConfirmOnClassicAnimation(): IClassicDeviceAnimation {
  return useSceneAnimation(CONFIRM).animation;
}

/* ---------------------------------------------------------------- *
 * Character-entry scenes (Enter PIN / Enter Passphrase - the original
 * Lottie files are frame-identical too), 5.8s loop: wake -> empty row fades in
 * -> six OK presses enter characters (each at mid-hold) -> the check appears at
 * the cursor -> one final OK press confirms -> sleep. Seven pulses total,
 * exactly like the Lottie files (their unexplained 7th press was this confirm).
 * ---------------------------------------------------------------- */

const ENTRY_PRESS_START_MS = 1250;
const ENTRY_PRESS_STEP_MS = 500;
const ENTRY_FILL_COUNT = 6;
const ENTRY = sceneTracks(
  5800,
  // Rest on the completed row: everything entered, the confirm press over.
  4750,
  4900,
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
