import { createContext, useContext } from 'react';

import { makeMutable, useAnimatedReaction } from 'react-native-reanimated';

import { easeInFn, easeOutFn, trackAt } from '../deviceScene';

import type { IKeyframe } from '../deviceScene';
import type { SharedValue } from 'react-native-reanimated';

export type IClassicDeviceButtonKey = 'power' | 'up' | 'down' | 'ok';

/**
 * Animation contract of the code-drawn Classic device, one field per layer of
 * the decomposition: ScreenPower (the glow/content opacity pair) and
 * ButtonPress (one 0..1 value per physical key). Under the presence engine
 * both screen fields ride the one screen-content opacity — the faint panel
 * glow is part of what "content shown" looks like on this OLED, not a
 * separate wake beat.
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
 * Classic scene vocabulary. The presence machinery (entrance, exit, the
 * scene clock) lives in ../deviceSceneHost like every replica's; this file
 * adds what is Classic-only — the physical-key press envelope and the
 * schedules its scenes play on the clock:
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

/* ------------------------- press drive ------------------------- *
 * The OK key lives on the shell body, outside the screen slot the presence
 * host swaps, so a scene cannot hand its press values over as render
 * output. Instead the device provides one per-instance drive through this
 * context and every scene steers it from its own clock. Per instance, not
 * a module mutable: two Classics on one screen (the story grids) must not
 * share a key. */

export interface IClassicPressDrive {
  ok: SharedValue<number>;
}

export const ClassicPressContext = createContext<IClassicPressDrive | null>(
  null,
);

/** The no-press track; scenes without key work still park the key at 0. */
export const PRESS_IDLE_TRACK: IKeyframe[] = [{ t: 0, v: 0 }];

/**
 * Steers the device's OK key along `track` on the scene clock. Every scene
 * mounts this — including with PRESS_IDLE_TRACK — so the key can never stay
 * stuck where the previous scene's unmount left it.
 */
export function useOkPressDrive(
  clock: SharedValue<number>,
  track: IKeyframe[],
): void {
  const drive = useContext(ClassicPressContext);
  useAnimatedReaction(
    () => (drive ? trackAt(clock.value, track) : 0),
    (value, previous) => {
      if (drive && value !== previous) {
        drive.ok.value = value;
      }
    },
    [clock, drive, track],
  );
}

/* ---------------------- character entry ---------------------- *
 * Enter PIN / Enter Passphrase, one shared schedule: six OK presses enter
 * characters (each fill lands mid-hold), the check appears at the cursor,
 * one final OK press confirms — seven pulses, exactly like the original
 * Lottie files. With no screen sleep to hide the loop seam anymore, the
 * row closes it on its own: hold the completed row, fade the row out,
 * fade it back in empty, and the presses start over. Rest is the
 * completed row, key quiet. */

const ENTRY_PRESS_START_MS = 400;
const ENTRY_PRESS_STEP_MS = 500;
export const ENTRY_FILL_COUNT = 6;
export const ENTRY_OK_TRACK = pressPulsesTrack(
  Array.from(
    { length: ENTRY_FILL_COUNT + 1 },
    (_, i) => ENTRY_PRESS_START_MS + i * ENTRY_PRESS_STEP_MS,
  ),
);

const ENTRY_ROW_OUT_START_MS = 4800;
const ENTRY_ROW_OUT_END_MS = 5100;
const ENTRY_ROW_IN_START_MS = 5300;
const ENTRY_ROW_IN_END_MS = 5550;
export const ENTRY_LOOP = { loopMs: 5600, restMs: 4200 };

/** Opacity of the whole slot row: out at the loop seam, back just before. */
export const ENTRY_ROW_TRACK: IKeyframe[] = [
  { t: 0, v: 1 },
  { t: ENTRY_ROW_OUT_START_MS, v: 1, e: easeInFn },
  { t: ENTRY_ROW_OUT_END_MS, v: 0 },
  { t: ENTRY_ROW_IN_START_MS, v: 0, e: easeOutFn },
  { t: ENTRY_ROW_IN_END_MS, v: 1 },
];

/* Every changing element transitions on the clock rather than snapping:
 * a fill cross-fades its slot pending -> entered, the check cross-fades in
 * over the cursor's pending glyph, and the caret pair slides to the next
 * slot. Inside the row's hidden window every track snaps back for the
 * next pass — off-glass, so nothing pops on a lit screen. */

const GLYPH_FADE_MS = 180;
const CARET_SLIDE_MS = 240;
const RESET_START_MS = ENTRY_ROW_OUT_END_MS;
const RESET_END_MS = ENTRY_ROW_OUT_END_MS + 20;

/** Fill i lands mid-hold of press i. */
const entryFillMs = (i: number) =>
  ENTRY_PRESS_START_MS + i * ENTRY_PRESS_STEP_MS + PRESS_ACT_OFFSET_MS;
/** The check lands with the last fill, replacing the cursor's glyph. */
const ENTRY_CHECK_AT_MS = entryFillMs(ENTRY_FILL_COUNT - 1);

function fadeInAt(atMs: number): IKeyframe[] {
  return [
    { t: 0, v: 0 },
    { t: atMs, v: 0, e: easeOutFn },
    { t: atMs + GLYPH_FADE_MS, v: 1 },
    { t: RESET_START_MS, v: 1 },
    { t: RESET_END_MS, v: 0 },
  ];
}

function fadeOutAt(atMs: number): IKeyframe[] {
  return [
    { t: 0, v: 1 },
    { t: atMs, v: 1, e: easeOutFn },
    { t: atMs + GLYPH_FADE_MS, v: 0 },
    { t: RESET_START_MS, v: 0 },
    { t: RESET_END_MS, v: 1 },
  ];
}

/** Opacity of entered glyph / pending glyph per fillable slot, cross-fading. */
export const ENTRY_ENTERED_TRACKS = Array.from(
  { length: ENTRY_FILL_COUNT },
  (_, i) => fadeInAt(entryFillMs(i)),
);
export const ENTRY_PENDING_TRACKS = Array.from(
  { length: ENTRY_FILL_COUNT },
  (_, i) => fadeOutAt(entryFillMs(i)),
);
export const ENTRY_CHECK_TRACK = fadeInAt(ENTRY_CHECK_AT_MS);
export const ENTRY_CURSOR_PENDING_TRACK = fadeOutAt(ENTRY_CHECK_AT_MS);

/**
 * TranslateX of the caret pair over its slot-0 base, sliding one slot per
 * fill. `slotShiftPx` is the slot pitch on the device's content canvas.
 */
export function entryCaretShiftTrack(slotShiftPx: number): IKeyframe[] {
  const kfs: IKeyframe[] = [{ t: 0, v: 0 }];
  for (let i = 0; i < ENTRY_FILL_COUNT; i += 1) {
    kfs.push(
      { t: entryFillMs(i), v: i * slotShiftPx, e: easeOutFn },
      { t: entryFillMs(i) + CARET_SLIDE_MS, v: (i + 1) * slotShiftPx },
    );
  }
  kfs.push(
    { t: RESET_START_MS, v: ENTRY_FILL_COUNT * slotShiftPx },
    { t: RESET_END_MS, v: 0 },
  );
  return kfs;
}
