import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { BakedChrome } from '../deviceSceneHost';

import { PRO_DEVICE_SCREEN_OFF, PRO_DEVICE_SCREEN_ON } from './animation';

import type { IProDeviceAnimation } from './animation';

/**
 * OneKey Pro device, 1:1 against Figma node 20620:967 (350x569 @1x: a
 * 346-wide body plus the 4pt power tab on the right edge). The chrome —
 * the black slab, the glass plate's seam, the frame edge light, the top
 * lights, the bottom shadow, the wordmark and the power tab — ships as
 * a pre-baked bitmap (shell@2x/@3x, exported straight from the Figma
 * frame at 280pt, the stage's largest rendering). Two things stay code:
 *
 * - The screen: dynamic content on the 288x484 canvas, clipped by its
 *   cutout. The panel color keeps the Screen frame's own white 5% baked
 *   in (#0D0D0D), exactly as the transcription had it.
 * - The glass film over the screen: the glass plate's white 5% fill is
 *   the reflection film over whatever the panel shows, so it must paint
 *   ABOVE live content — a plain overlay inside the screen cutout. The
 *   baked chrome carries the same film outside the cutout (and its seam
 *   stroke), so margins wear it exactly once. Screen-off glass still
 *   composites to 25/255, matching the Figma render.
 *
 * The chrome was first transcribed as code-drawn SVG (see git history
 * for the five-layer light recipe and the sigma pixel-fitting). The
 * 2026-08-28 flight profiling convicted that approach: react-native-svg
 * filters sample their backdrop, so every frame of the capsule<->card
 * morph re-rendered the shells through CoreImage on the main thread —
 * and the whole family moved to baked chrome, which also restores the
 * design's exact fractional blur radii.
 */

const DEVICE_W = 350;
const DEVICE_H = 569;

/** Touchscreen size; scene screen content is laid out on this canvas. */
export const PRO_SCREEN_W = 288;
export const PRO_SCREEN_H = 484;
/**
 * The screen panel surface (see `screen` below for the derivation) —
 * also what scene content composites over, so a scene repainting the
 * bare surface (the passphrase gap grille) uses this exact value.
 */
export const PRO_SCREEN_BG = '#0D0D0D';

const SHELL_SOURCE = require('./shell.png');

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  device: {
    width: DEVICE_W,
    height: DEVICE_H,
  },
  // Square-cornered panel, opaque so nothing shows through from
  // underneath. #0D0D0D is black carrying the Screen frame's own white 5%
  // fill (0.05 * 255 = 12.75 -> 13): that fill is the panel surface the UI
  // is drawn on, so it belongs under the content.
  screen: {
    position: 'absolute',
    left: 29,
    top: 26,
    width: PRO_SCREEN_W,
    height: PRO_SCREEN_H,
    backgroundColor: PRO_SCREEN_BG,
    overflow: 'hidden',
  },
  screenSlot: {
    ...StyleSheet.absoluteFill,
  },
  // The glass plate's reflection film over the panel — the light that
  // belongs ON the glass, so it paints above live content.
  screenFilm: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});

// Memoized like the sibling shells: only a scene change re-renders it.
const DeviceBody = memo(function DeviceBody({
  animation,
  screenContent,
}: {
  animation: IProDeviceAnimation;
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
        <View pointerEvents="none" style={styles.screenFilm} />
      </View>
    </>
  );
});

export interface IProDeviceShellProps {
  /**
   * Rendered width in points. Height follows the fixed 350:569 aspect ratio.
   */
  width?: number;
  /**
   * Node lit on the 288x484 touchscreen. Keep it referentially stable (a
   * module constant or useMemo): the body memoizes on it.
   */
  screenContent?: ReactNode;
  /**
   * Scene-produced animation contract (see ./animation.ts). Omitted: a bare
   * shell keeps the screen dark; with screenContent it shows steady-on.
   */
  animation?: IProDeviceAnimation;
}

export function ProDeviceShell({
  width = DEVICE_W,
  screenContent,
  animation,
}: IProDeviceShellProps) {
  const scale = width / DEVICE_W;
  const resolvedAnimation =
    animation ?? (screenContent ? PRO_DEVICE_SCREEN_ON : PRO_DEVICE_SCREEN_OFF);
  // Outer frame carries the true layout size (a transform is paint-only);
  // the inner view keeps the explicit 350x569 so transformOrigin resolves
  // against a stable frame. Same pattern as the sibling shells.
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
