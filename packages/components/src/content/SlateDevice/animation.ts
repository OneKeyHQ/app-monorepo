import { makeMutable } from 'react-native-reanimated';

import type { SharedValue } from 'react-native-reanimated';

/**
 * Animation contract of the code-drawn Slate device: the ScreenPower pair,
 * same shape as the other touchscreen shell. The device has no face keys, so
 * any future tap feedback belongs inside scene screen content.
 *
 * No scene schedules live here yet - the replica ships as a static shell
 * until its scenes are designed. Scenes will derive their tracks from
 * ../deviceScene like the siblings do.
 */
export interface ISlateDeviceAnimation {
  /** 0 dark .. 1 the faint powered-on luminance across the whole glass. */
  screenGlow: Readonly<SharedValue<number>>;
  /** 0 hidden .. 1 shown, opacity of the screenContent node. */
  screenContent: Readonly<SharedValue<number>>;
}

const VALUE_OFF = makeMutable(0);
const VALUE_ON = makeMutable(1);

// Static fallbacks for animation-less usages, mirroring the sibling statics.
export const SLATE_DEVICE_SCREEN_OFF: ISlateDeviceAnimation = {
  screenGlow: VALUE_OFF,
  screenContent: VALUE_OFF,
};
export const SLATE_DEVICE_SCREEN_ON: ISlateDeviceAnimation = {
  screenGlow: VALUE_ON,
  screenContent: VALUE_ON,
};
