import { useEffect, useMemo } from 'react';

import {
  Easing,
  cancelAnimation,
  makeMutable,
  useDerivedValue,
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
  /** 0 released .. 1 fully pressed, per physical key. */
  press: Record<IClassicDeviceButtonKey, Readonly<SharedValue<number>>>;
}

// Static fallbacks for animation-less usages: a bare shell keeps the screen
// dark (pixel-identical to the verified static device), a shell given static
// screenContent shows it steady-on.
const STATIC_ZERO = makeMutable(0);
const STATIC_ONE = makeMutable(1);
const STATIC_PRESS: IClassicDeviceAnimation['press'] = {
  power: STATIC_ZERO,
  up: STATIC_ZERO,
  down: STATIC_ZERO,
  ok: STATIC_ZERO,
};
export const CLASSIC_DEVICE_SCREEN_OFF: IClassicDeviceAnimation = {
  screenGlow: STATIC_ZERO,
  screenContent: STATIC_ZERO,
  press: STATIC_PRESS,
};
export const CLASSIC_DEVICE_SCREEN_ON: IClassicDeviceAnimation = {
  screenGlow: STATIC_ONE,
  screenContent: STATIC_ONE,
  press: STATIC_PRESS,
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

// Confirm loop, 3s: panel wakes (0-280ms) -> skeleton fades in (240-700ms) ->
// OK presses (1100-1450ms: 100 down / 150 hold / 100 up, the envelope of the
// original confirm-on-classic.json) -> screen sleeps (2100-2400ms) -> dark
// rest until 3000ms. The device shell itself never enters or exits.
const CONFIRM_LOOP_MS = 3000;
const CONFIRM_GLOW: IKeyframe[] = [
  { t: 0, v: 0, e: easeOutFn },
  { t: 280, v: 1 },
  { t: 2100, v: 1, e: easeInFn },
  { t: 2400, v: 0 },
];
const CONFIRM_CONTENT: IKeyframe[] = [
  { t: 0, v: 0 },
  { t: 240, v: 0, e: easeOutFn },
  { t: 700, v: 1 },
  { t: 2100, v: 1, e: easeInFn },
  { t: 2400, v: 0 },
];
const CONFIRM_OK: IKeyframe[] = [
  { t: 0, v: 0 },
  { t: 1100, v: 0, e: easeOutFn },
  { t: 1200, v: 1 },
  { t: 1350, v: 1, e: easeInFn },
  { t: 1450, v: 0 },
];

export function useConfirmOnClassicAnimation(): IClassicDeviceAnimation {
  const clock = useSharedValue(0);
  useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(CONFIRM_LOOP_MS, {
        duration: CONFIRM_LOOP_MS,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    return () => cancelAnimation(clock);
  }, [clock]);

  const screenGlow = useDerivedValue(() => trackAt(clock.value, CONFIRM_GLOW));
  const screenContent = useDerivedValue(() =>
    trackAt(clock.value, CONFIRM_CONTENT),
  );
  const okPress = useDerivedValue(() => trackAt(clock.value, CONFIRM_OK));

  return useMemo(
    () => ({
      screenGlow,
      screenContent,
      press: {
        power: STATIC_ZERO,
        up: STATIC_ZERO,
        down: STATIC_ZERO,
        ok: okPress,
      },
    }),
    [screenGlow, screenContent, okPress],
  );
}
