import { useEffect, useMemo } from 'react';

import {
  Easing,
  cancelAnimation,
  makeMutable,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { easeOutFn, trackAt } from '../deviceScene';

import type { IKeyframe } from '../deviceScene';
import type { SharedValue } from 'react-native-reanimated';

/**
 * Animation contract of the code-drawn Slate device: the ScreenPower pair,
 * same shape as the other touchscreen shell. The device has no face keys, so
 * any future tap feedback belongs inside scene screen content.
 *
 * The connecting scene's boot clock lives here too. Unlike the sibling
 * scene loops it is a one-shot: connecting has no natural end on the
 * device, so the screen lights once and stays lit.
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

/* ------------------------- connecting ------------------------- *
 * The shared wake vocabulary stretched x1.5 - the wallpaper reveal reads
 * better unhurried - played once: glow rises, the panel holds
 * lit-but-empty for a beat, then the wallpaper renders in (over pure
 * black an opacity ramp IS a luminance ramp). */

// The shared 500 / 720-1100 wake, stretched x1.5 for this scene only.
const CONNECT_WAKE_GLOW_MS = 750;
const CONNECT_CONTENT_IN_START_MS = 1080;
const CONNECT_CONTENT_IN_END_MS = 1650;

const WAKE_GLOW_TRACK: IKeyframe[] = [
  { t: 0, v: 0, e: easeOutFn },
  { t: CONNECT_WAKE_GLOW_MS, v: 1 },
];
const WAKE_CONTENT_TRACK: IKeyframe[] = [
  { t: 0, v: 0 },
  { t: CONNECT_CONTENT_IN_START_MS, v: 0, e: easeOutFn },
  { t: CONNECT_CONTENT_IN_END_MS, v: 1 },
];

/**
 * Drives the connecting scene. Under reduced motion the screen holds lit
 * with the wallpaper shown - awake and calm rather than dark.
 */
export function useConnectingOnSlateAnimation() {
  const boot = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (reducedMotion) {
      boot.value = CONNECT_CONTENT_IN_END_MS;
      return undefined;
    }
    boot.value = 0;
    boot.value = withTiming(CONNECT_CONTENT_IN_END_MS, {
      duration: CONNECT_CONTENT_IN_END_MS,
      easing: Easing.linear,
    });
    return () => cancelAnimation(boot);
  }, [boot, reducedMotion]);
  const screenGlow = useDerivedValue(
    () => trackAt(boot.value, WAKE_GLOW_TRACK),
    [boot],
  );
  const screenContent = useDerivedValue(
    () => trackAt(boot.value, WAKE_CONTENT_TRACK),
    [boot],
  );
  const animation: ISlateDeviceAnimation = useMemo(
    () => ({ screenGlow, screenContent }),
    [screenGlow, screenContent],
  );
  return { animation };
}
