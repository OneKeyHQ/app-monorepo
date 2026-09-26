import type { IOverlayMotion, IOverlayMotionPreset } from './types';

const EASE: readonly [number, number, number, number] = [0.25, 0.1, 0.25, 1];
const EASE_OUT: readonly [number, number, number, number] = [0, 0, 0.58, 1];

function spring(mass: number, stiffness: number, damping: number) {
  return { type: 'spring', spring: { mass, stiffness, damping } } as const;
}

function timing(
  durationMs: number,
  easing: readonly [number, number, number, number],
) {
  return { type: 'timing', timing: { durationMs, easing } } as const;
}

/**
 * Native tokens mirror `packages/components/tamagui.animations.native.ts`
 * (Reanimated driver). `quick` intentionally uses a damping ratio of ~3.16 (no overshoot).
 */
export const NATIVE_MOTION_PRESETS: Record<
  IOverlayMotionPreset,
  IOverlayMotion
> = {
  quick: spring(0.1, 100, 20),
  popoverQuick: timing(150, [0.215, 0.61, 0.355, 1]),
  smooth: spring(1, 438, 42),
  fast: spring(1.2, 250, 20),
  medium: spring(0.9, 100, 10),
  slow: spring(1, 60, 20),
  // @backpackapp-io/react-native-toast: 300ms Easing.inOut(Easing.quad).
  toastSlide: timing(300, [0.455, 0.03, 0.515, 0.955]),
  lockFade: timing(150, EASE_OUT),
};

/**
 * Web tokens mirror `packages/components/tamagui.animations.web.ts` (CSS
 * driver). Web keeps its own short curves; converting the native springs
 * would make web overlays several times slower than today.
 */
export const WEB_MOTION_PRESETS: Record<IOverlayMotionPreset, IOverlayMotion> =
  {
    quick: timing(150, EASE),
    popoverQuick: timing(150, [0.215, 0.61, 0.355, 1]),
    smooth: timing(300, [0.2, 0, 0, 1]),
    fast: timing(200, EASE_OUT),
    medium: timing(300, EASE_OUT),
    slow: timing(450, EASE_OUT),
    // sonner: transform / opacity 400ms ease.
    toastSlide: timing(400, EASE),
    lockFade: timing(150, EASE_OUT),
  };
