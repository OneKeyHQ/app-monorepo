import { useMemo } from 'react';

import { makeMutable, useDerivedValue } from 'react-native-reanimated';

import {
  easeOutFn,
  screenContentTrack,
  screenGlowTrack,
  trackAt,
  useSceneClock,
} from '../deviceScene';

import type { IKeyframe } from '../deviceScene';
import type { SharedValue } from 'react-native-reanimated';

/**
 * Animation contract of the code-drawn Pro device: just the ScreenPower pair.
 * The Pro has no face keys - every interaction is a tap on the touchscreen,
 * so tap feedback lives inside the scene's screen content (scenes derive
 * per-key highlight values from the same master clock) rather than on the
 * shell.
 */
export interface IProDeviceAnimation {
  /** 0 dark .. 1 the faint powered-on luminance across the whole glass. */
  screenGlow: Readonly<SharedValue<number>>;
  /** 0 hidden .. 1 shown, opacity of the screenContent node. */
  screenContent: Readonly<SharedValue<number>>;
}

const VALUE_OFF = makeMutable(0);
const VALUE_ON = makeMutable(1);

// Static fallbacks for animation-less usages, mirroring the Classic statics.
export const PRO_DEVICE_SCREEN_OFF: IProDeviceAnimation = {
  screenGlow: VALUE_OFF,
  screenContent: VALUE_OFF,
};
export const PRO_DEVICE_SCREEN_ON: IProDeviceAnimation = {
  screenGlow: VALUE_ON,
  screenContent: VALUE_ON,
};

/* ---------------------------------------------------------------- *
 * Pro scene vocabulary. Wake/sleep comes from ../deviceScene; this file
 * adds the touch envelope and the Pro schedules, both transcribed from the
 * Pro Lottie files (100fps):
 *  - tap: the key lights up instantly, holds lit 200ms, fades back 200ms
 *  - taps run on a 300ms cadence (touch is quicker than the Classic's
 *    500ms physical presses), the confirm tap 400ms after the last char
 * ---------------------------------------------------------------- */

const TAP_SNAP_MS = 10;
const TAP_HOLD_MS = 200;
const TAP_FADE_MS = 200;

function tapPulseTrack(startMs: number): IKeyframe[] {
  return [
    { t: 0, v: 0 },
    { t: startMs, v: 0 },
    { t: startMs + TAP_SNAP_MS, v: 1 },
    { t: startMs + TAP_SNAP_MS + TAP_HOLD_MS, v: 1, e: easeOutFn },
    { t: startMs + TAP_SNAP_MS + TAP_HOLD_MS + TAP_FADE_MS, v: 0 },
  ];
}

/** Derives one key's 0..1 highlight from the scene clock. */
export function useTapHighlight(
  clock: SharedValue<number>,
  track: IKeyframe[],
): Readonly<SharedValue<number>> {
  return useDerivedValue(() => trackAt(clock.value, track), [clock, track]);
}

function useProSceneAnimation(
  loopMs: number,
  restMs: number,
  sleepAtMs: number,
): { animation: IProDeviceAnimation; clock: SharedValue<number> } {
  const clock = useSceneClock(loopMs, restMs);
  const glowTrack = useMemo(() => screenGlowTrack(sleepAtMs), [sleepAtMs]);
  const contentTrack = useMemo(
    () => screenContentTrack(sleepAtMs),
    [sleepAtMs],
  );
  const screenGlow = useDerivedValue(() => trackAt(clock.value, glowTrack));
  const screenContent = useDerivedValue(() =>
    trackAt(clock.value, contentTrack),
  );
  const animation = useMemo(
    () => ({ screenGlow, screenContent }),
    [screenGlow, screenContent],
  );
  return useMemo(() => ({ animation, clock }), [animation, clock]);
}

/* ---------------------------------------------------------------- *
 * Confirm, 3.2s loop (same wall clock as the Classic confirm): wake ->
 * skeleton and confirm button fade in -> one tap on the button (it darkens
 * to the pressed fill, then eases back to green) -> sleep.
 * ---------------------------------------------------------------- */

export const CONFIRM_PRO_TAP_TRACK = tapPulseTrack(1450);

export function useConfirmOnProAnimation(): {
  animation: IProDeviceAnimation;
  clock: SharedValue<number>;
} {
  return useProSceneAnimation(3200, 1200, 2300);
}

/* ---------------------------------------------------------------- *
 * Character-entry scenes (Enter PIN / Enter Passphrase - the Lottie files
 * are frame-identical here too), 4.8s loop: wake -> keypad fades in -> six
 * taps enter characters on a 300ms cadence -> the submit key, enabled since
 * the first character, is tapped 400ms later -> sleep.
 * ---------------------------------------------------------------- */

const ENTRY_TAP_START_MS = 1250;
const ENTRY_TAP_STEP_MS = 300;
const ENTRY_FILL_COUNT = 6;
const ENTRY_SUBMIT_MS =
  ENTRY_TAP_START_MS + ENTRY_FILL_COUNT * ENTRY_TAP_STEP_MS + 100;

export const ENTRY_PRO_TAP_TRACKS = Array.from(
  { length: ENTRY_FILL_COUNT },
  (_, i) => tapPulseTrack(ENTRY_TAP_START_MS + i * ENTRY_TAP_STEP_MS),
);
export const ENTRY_PRO_SUBMIT_TRACK = tapPulseTrack(ENTRY_SUBMIT_MS);
// The submit key brightens from its disabled green once the first character
// lands (100ms after the first tap, as in the Lottie).
export const ENTRY_PRO_SUBMIT_ENABLE_TRACK: IKeyframe[] = [
  { t: 0, v: 0 },
  { t: ENTRY_TAP_START_MS + 100, v: 0 },
  { t: ENTRY_TAP_START_MS + 110, v: 1 },
];

/** How many characters are entered at clock time t (dots land on the tap). */
function entryEnteredAt(t: number): number {
  'worklet';

  let entered = 0;
  for (let i = 0; i < ENTRY_FILL_COUNT; i += 1) {
    if (t >= ENTRY_TAP_START_MS + i * ENTRY_TAP_STEP_MS) entered += 1;
  }
  return entered;
}

export function useEntryOnProAnimation(): {
  animation: IProDeviceAnimation;
  clock: SharedValue<number>;
  /** Characters entered so far, for the entry dots to follow. */
  entered: Readonly<SharedValue<number>>;
  fillCount: number;
} {
  const { animation, clock } = useProSceneAnimation(4800, 3700, 3900);
  const entered = useDerivedValue(() => entryEnteredAt(clock.value));
  return useMemo(
    () => ({ animation, clock, entered, fillCount: ENTRY_FILL_COUNT }),
    [animation, clock, entered],
  );
}
