import type { ReactNode } from 'react';
import { memo, useMemo } from 'react';

import { StyleSheet, View } from 'react-native';
import Animated, {
  makeMutable,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { BakedChrome } from '../deviceSceneHost';

import type { IDeviceScreenAnimation } from '../deviceSceneHost';

/**
 * OneKey Mini device, 1:1 against Figma node 21585:44511 (657x1419 on
 * the canvas: a 651-wide white body plus the power tab on the right
 * edge). The chrome — body, edge vignette, top lights and bottom
 * shadows, the embossed direction-key dots and the power tab — ships as
 * a pre-baked bitmap (shell-mini@2x/@3x, exported straight from the Figma
 * frame at 280pt, the stage's largest rendering). Only the screen stays
 * code: its content is dynamic and its cutout provides the clip.
 *
 * The chrome was first transcribed as code-drawn SVG and inset-shadow
 * views (see git history). The 2026-08-28 flight profiling convicted
 * the SVG-filter half of that approach — react-native-svg filters
 * sample their backdrop, so every frame of the capsule<->card morph
 * re-rendered the shells through CoreImage on the main thread — and the
 * whole family moved to baked chrome. The bitmap also carries the
 * design's exact blur and spread values, which the transcription had to
 * approximate (integer sigmas for the CIFilter-by-pointer-equality
 * quirk, boxShadow in place of feMorphology spread).
 *
 * The keys are still: the design asks for no press on the Mini's
 * engraved membrane, so no press drive exists here — which is what lets
 * the dots bake into the chrome. Scenes author against the glass box
 * itself (no inset slot like the Classic's).
 */

const DEVICE_W = 657;
const DEVICE_H = 1417;

/** The glass, which is also the content canvas: scenes author against
 * its full box (no inset slot like the Classic's). */
export const SCREEN_GLASS_W = 505;
export const SCREEN_GLASS_H = 518;

/**
 * Animation contract of the Mini: the presence engine's one screen
 * opacity, nothing else — the keys do not move.
 */
export type IMiniDeviceAnimation = IDeviceScreenAnimation;

// Static fallbacks for animation-less usages, the Classic's pair restated:
// a bare shell keeps the screen dark, static screenContent shows steady-on.
const SCREEN_OFF_VALUE = makeMutable(0);
const SCREEN_ON_VALUE = makeMutable(1);
export const MINI_DEVICE_SCREEN_OFF: IMiniDeviceAnimation = {
  screenContent: SCREEN_OFF_VALUE,
};
export const MINI_DEVICE_SCREEN_ON: IMiniDeviceAnimation = {
  screenContent: SCREEN_ON_VALUE,
};

// The model suffix keeps the filename unique: webpack/rspack dev emits
// assets as bare [name].[ext], where same-named files overwrite each other.
const SHELL_SOURCE = require('./shell-mini.png');

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  device: {
    width: DEVICE_W,
    height: DEVICE_H,
  },
  screen: {
    position: 'absolute',
    left: 73,
    top: 74,
    width: SCREEN_GLASS_W,
    height: SCREEN_GLASS_H,
    borderRadius: 18,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  // Powered-on-but-empty panel: the family's faint luminance field.
  screenGlow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  screenSlot: {
    ...StyleSheet.absoluteFill,
  },
});

// Memoized like the sibling shells: only a scene change re-renders it.
const DeviceBody = memo(function DeviceBody({
  animation,
  screenContent,
}: {
  animation: IMiniDeviceAnimation;
  screenContent?: ReactNode;
}) {
  // The panel glow and the content share the one presence opacity: "lit"
  // is nothing but content shown.
  const litStyle = useAnimatedStyle(
    () => ({ opacity: animation.screenContent.value }),
    [animation],
  );
  const glowLayerStyle = useMemo(
    () => [styles.screenGlow, litStyle],
    [litStyle],
  );
  const slotLayerStyle = useMemo(
    () => [styles.screenSlot, litStyle],
    [litStyle],
  );
  return (
    <>
      <BakedChrome source={SHELL_SOURCE} width={DEVICE_W} height={DEVICE_H} />
      <View style={styles.screen}>
        <Animated.View pointerEvents="none" style={glowLayerStyle} />
        {screenContent ? (
          <Animated.View pointerEvents="none" style={slotLayerStyle}>
            {screenContent}
          </Animated.View>
        ) : null}
      </View>
    </>
  );
});

export interface IMiniDeviceShellProps {
  /**
   * Rendered width in points. Height follows the fixed 657:1417 aspect
   * ratio; the canvas is the Figma node's own size, so every realistic
   * width shrinks it.
   */
  width?: number;
  /**
   * Node lit on the 505x518 glass. Keep it referentially stable (a module
   * constant or useMemo): the body memoizes on it.
   */
  screenContent?: ReactNode;
  /**
   * Scene-produced animation contract. Omitted: a bare shell keeps the
   * screen dark; with screenContent it shows steady-on.
   */
  animation?: IMiniDeviceAnimation;
}

export function MiniDeviceShell({
  width = DEVICE_W / 2,
  screenContent,
  animation,
}: IMiniDeviceShellProps) {
  const scale = width / DEVICE_W;
  const resolvedAnimation =
    animation ??
    (screenContent ? MINI_DEVICE_SCREEN_ON : MINI_DEVICE_SCREEN_OFF);
  // Outer frame carries the true layout size (a transform is paint-only);
  // the inner view keeps the explicit canvas size so transformOrigin
  // resolves against a stable frame. Same pattern as the other shells.
  const frameStyle = useMemo(
    () => [styles.frame, { width: DEVICE_W * scale, height: DEVICE_H * scale }],
    [scale],
  );
  const deviceStyle = useMemo(
    () => [styles.device, { transform: [{ scale }] }],
    [scale],
  );
  return (
    <View style={frameStyle}>
      <View style={deviceStyle}>
        <DeviceBody
          animation={resolvedAnimation}
          screenContent={screenContent}
        />
      </View>
    </View>
  );
}
