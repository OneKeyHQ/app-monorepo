import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { BakedChrome } from '../deviceSceneHost';

import { PRO2_DEVICE_SCREEN_OFF, PRO2_DEVICE_SCREEN_ON } from './animation';

import type { IPro2DeviceAnimation } from './animation';

/**
 * Pro 2 device, 1:1 against Figma node 20496:27747. The chrome — the
 * black body, the metal highlight rings, the top bloom, the corner
 * glints, the decoration bar and the side power button — ships as a
 * pre-baked bitmap (shell-pro2@2x/@3x, exported straight from the Figma
 * frame at 280pt, the stage's largest rendering). Only the screen stays
 * code: its content is dynamic (scenes on the 288x484 canvas) and its
 * cutout provides the clip.
 *
 * The chrome was first transcribed as code-drawn SVG — blurred strokes
 * and painted fills, see git history for the full transcription. The
 * 2026-08-28 flight profiling convicted that approach: react-native-svg
 * filters sample their backdrop, so every frame of the capsule<->card
 * morph re-rendered the whole SVG through CoreImage on the main thread.
 * A bitmap has no filters to re-run — and it carries the design's exact
 * blur radii, which the SVG transcription had to round to integer
 * sigmas to dodge the CIFilter-by-pointer-equality quirk in
 * react-native-svg.
 *
 * The source frame is drawn at 1084x1714 Figma px; px() maps every
 * transcribed value onto a canvas whose width is derived so the screen
 * cutout measures exactly the 288pt content canvas (334.25, not the
 * siblings' 350 — see DEVICE_W; height 528.5 follows the device's
 * aspect ratio).
 *
 * The screen stays pure black at all times — "lighting up" is only the
 * content rendering in, so there is no separate glow layer. Screen
 * content targets the 288x484 canvas and shows through the cutout 1:1
 * (~0.3pt of vertical overrun at each end clipped by the screen).
 */

/** Figma px of the source frame (body 1080 + the 4px power tab). */
const FIGMA_W = 1084;
const FIGMA_H = 1714;
/** Figma px of the screen cutout's width. */
const FIGMA_SCREEN_W = 934;

/**
 * Screen content canvas. Content is laid out on this fixed grid and shows
 * through the physical cutout 1:1 — no slot scale, see DEVICE_W.
 */
export const PRO2_SCREEN_W = 288;
export const PRO2_SCREEN_H = 484;

/**
 * The canvas width is derived so the screen cutout measures exactly the
 * 288pt content canvas (334.25, where the siblings draw at 350): scene
 * glyphs then rasterize at the size the stage shows them — one
 * whole-device minification, like the Pro — instead of riding an extra
 * ~1.047 slot upscale, whose resampling read as bitmap-edged text
 * (2026-08-31). The stage size itself is untouched: the canvas is only
 * a coordinate system, and every px() value scales with it.
 */
const DEVICE_W = (PRO2_SCREEN_W * FIGMA_W) / FIGMA_SCREEN_W;

/** Figma px -> canvas points (K = FIGMA_W/DEVICE_W), rounded to 1/10000pt. */
function px(v: number): number {
  return Math.round(((v * DEVICE_W) / FIGMA_W) * 10_000) / 10_000;
}

const DEVICE_H = px(FIGMA_H);

// The model suffix keeps the filename unique: webpack/rspack dev emits
// assets as bare [name].[ext], where same-named files overwrite each other.
const SHELL_SOURCE = require('./shell-pro2.png');

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
    left: px(73),
    top: px(73),
    width: px(934),
    height: px(1568),
    borderRadius: px(132),
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  // 288x484 content canvas centered in the cutout 1:1; the ~0.3pt of
  // vertical overrun at each end is clipped by the screen.
  screenSlot: {
    position: 'absolute',
    left: (px(934) - PRO2_SCREEN_W) / 2,
    top: (px(1568) - PRO2_SCREEN_H) / 2,
    width: PRO2_SCREEN_W,
    height: PRO2_SCREEN_H,
  },
});

// Memoized like the sibling shells: keep both props referentially stable so
// the chrome only re-renders when they actually change.
const DeviceBody = memo(function DeviceBody({
  animation,
  screenContent,
}: {
  animation: IPro2DeviceAnimation;
  screenContent?: ReactNode;
}) {
  const slotStyle = useAnimatedStyle(
    () => ({ opacity: animation.screenContent.value }),
    [animation],
  );
  const slotLayerStyle = useMemo(
    () => [styles.screenSlot, slotStyle],
    [slotStyle],
  );
  return (
    <>
      <BakedChrome source={SHELL_SOURCE} width={DEVICE_W} height={DEVICE_H} />
      <View style={styles.screen}>
        {screenContent ? (
          <Animated.View pointerEvents="none" style={slotLayerStyle}>
            {screenContent}
          </Animated.View>
        ) : null}
      </View>
    </>
  );
});

export interface IPro2DeviceShellProps {
  /**
   * Rendered width in points. Height follows the fixed 1084:1714 aspect
   * ratio (528.5 at the default 334.25).
   */
  width?: number;
  /**
   * Node lit on the 288x484 screen canvas. Keep it referentially stable (a
   * module constant or useMemo): the body memoizes on it.
   */
  screenContent?: ReactNode;
  /**
   * Animation contract (see ./animation.ts). Omitted: a bare shell keeps the
   * screen dark; with screenContent it shows steady-on.
   */
  animation?: IPro2DeviceAnimation;
}

export function Pro2DeviceShell({
  width = DEVICE_W,
  screenContent,
  animation,
}: IPro2DeviceShellProps) {
  const scale = width / DEVICE_W;
  const resolvedAnimation =
    animation ??
    (screenContent ? PRO2_DEVICE_SCREEN_ON : PRO2_DEVICE_SCREEN_OFF);
  // Outer frame carries the true layout size (a transform is paint-only);
  // the inner view keeps the explicit canvas size so transformOrigin
  // resolves against a stable frame. Same pattern as the sibling shells.
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
