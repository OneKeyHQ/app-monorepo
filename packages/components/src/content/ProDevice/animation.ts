import { makeMutable } from 'react-native-reanimated';

import {
  MARKS_OUT_MS,
  MARK_STEP_MS,
  PIN_LIGHT_MS,
  SWEEP_TRAVEL_MS,
  entrySchedule,
} from '../deviceScene';

import type { SharedValue } from 'react-native-reanimated';

/**
 * Animation contract of the code-drawn Pro device: one track, the screen
 * content's opacity — the 2026-08-12 alignment onto the Pro 2's presence
 * model. The screen has no wake or sleep and no powered-on glow layer:
 * "lighting up" is nothing more than content rendering in, and scenes stay
 * lit, looping only their light choreography. The Pro has no face keys, so
 * anything that were to move on a key belongs inside scene screen content.
 *
 * The screen-power constants, the light tracks and the entry-schedule
 * generator live in ../deviceScene (the presence vocabulary, shared with
 * the Pro2Device); this file pins the Pro's own mark metrics into them.
 */
export interface IProDeviceAnimation {
  /** 0 hidden .. 1 shown, opacity of the screenContent node. */
  screenContent: Readonly<SharedValue<number>>;
}

const VALUE_OFF = makeMutable(0);
const VALUE_ON = makeMutable(1);

// Static fallbacks for animation-less usages, mirroring the sibling statics.
export const PRO_DEVICE_SCREEN_OFF: IProDeviceAnimation = {
  screenContent: VALUE_OFF,
};
export const PRO_DEVICE_SCREEN_ON: IProDeviceAnimation = {
  screenContent: VALUE_ON,
};

/** Half a PIN marks-row slot (dot 9 + gap 8), the nudge per landing. */
const PIN_MARK_HALF_STEP = 8.5;

/* enterPin: the 3x4 keypad wavefront, four entered marks (the marks row is
 * centered, so each landing nudges the cluster like on the Pro 2). */
const PIN_ENTRY = entrySchedule(PIN_LIGHT_MS, 4, PIN_MARK_HALF_STEP);
/** Scene loop for the registry (4800ms, resting on the complete row). */
export const PIN_LOOP = PIN_ENTRY.loop;
export const PIN_DOT_TRACKS = PIN_ENTRY.markTracks;
export const PIN_DOT_SHIFT_TRACKS = PIN_ENTRY.markShiftTracks;

/* enterPassphrase: the keyboard sweep, six entered marks. The marks sit
 * left-aligned in the entry field (the firmware's layout), so they land in
 * place — the centering shift stays unused. */
const PASSPHRASE_MARKS = 6;
const PASSPHRASE_ENTRY = entrySchedule(SWEEP_TRAVEL_MS, PASSPHRASE_MARKS, 0);
/** Scene loop for the registry (5100ms, resting on the complete row). */
export const PASSPHRASE_LOOP = PASSPHRASE_ENTRY.loop;
export const PASSPHRASE_DOT_TRACKS = PASSPHRASE_ENTRY.markTracks;

/** Marks shown at clock time t, for the n/50 counter to follow. */
export function passphraseEnteredAt(t: number): number {
  'worklet';

  if (t >= PASSPHRASE_ENTRY.marksOutStartMs + MARKS_OUT_MS) return 0;
  let entered = 0;
  for (let i = 0; i < PASSPHRASE_MARKS; i += 1) {
    if (t >= PASSPHRASE_ENTRY.markStartMs + i * MARK_STEP_MS) entered += 1;
  }
  return entered;
}
