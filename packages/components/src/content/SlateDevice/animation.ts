import { makeMutable } from 'react-native-reanimated';

import { PIN_LIGHT_MS, SWEEP_TRAVEL_MS, entrySchedule } from '../deviceScene';

import type { SharedValue } from 'react-native-reanimated';

/**
 * Animation contract of the code-drawn Slate device: one track, the screen
 * content's opacity. Per the design ruling the glass itself stays pure
 * black at all times - there is no panel luminance layer, and "waking" is
 * nothing more than content rendering in (over pure black an opacity ramp
 * IS a luminance ramp). The device has no face keys, so any future tap
 * feedback belongs inside scene screen content.
 *
 * The screen-power constants, the light tracks and the entry-schedule
 * generator live in ../deviceScene (the presence vocabulary, shared with
 * the ProDevice); this file pins the Slate's own mark metrics into them.
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

/** Half a marks-row slot (disc 5.5 + gap 7.5), the nudge per landing. */
const MARK_HALF_STEP = 6.5;

/* enterPin: the 3x4 keypad wavefront, four entered marks. */
const PIN_ENTRY = entrySchedule(PIN_LIGHT_MS, 4, MARK_HALF_STEP);
/** Scene loop for the registry (4800ms, resting on the complete row). */
export const PIN_LOOP = PIN_ENTRY.loop;
export const PIN_DOT_TRACKS = PIN_ENTRY.markTracks;
export const PIN_DOT_SHIFT_TRACKS = PIN_ENTRY.markShiftTracks;

/* enterPassphrase: the panel sweep, six entered marks. */
const PASSPHRASE_ENTRY = entrySchedule(SWEEP_TRAVEL_MS, 6, MARK_HALF_STEP);
/** Scene loop for the registry (5100ms, resting on the complete row). */
export const PASSPHRASE_LOOP = PASSPHRASE_ENTRY.loop;
export const PASSPHRASE_DOT_TRACKS = PASSPHRASE_ENTRY.markTracks;
export const PASSPHRASE_DOT_SHIFT_TRACKS = PASSPHRASE_ENTRY.markShiftTracks;
