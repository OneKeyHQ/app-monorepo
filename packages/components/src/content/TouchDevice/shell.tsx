import type { ReactNode } from 'react';
import { memo, useMemo } from 'react';

import { StyleSheet, View } from 'react-native';
import Animated, {
  makeMutable,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { BakedChrome } from '../deviceSceneHost';
import { PRO_SCREEN_H, PRO_SCREEN_W } from '../ProDevice/shell';

import type { IDeviceScreenAnimation } from '../deviceSceneHost';

/**
 * OneKey Touch device, 1:1 against its Figma node (1044x1751 on the
 * canvas: a 1038-wide body plus the power tab on the right edge). The
 * chrome — the metal frame and its side sheens, the plate/ring/face
 * stack, the wordmark and chin shadow, and the power tab — ships as a
 * pre-baked bitmap (shell-touch@2x/@3x, exported straight from the Figma
 * frame at 280pt, the stage's largest rendering). Only the screen
 * window stays code: it has no fill of its own (off, it is
 * indistinguishable from the baked face around it) and only clips the
 * live content.
 *
 * The chrome was first transcribed as code-drawn views and SVG (see git
 * history). The 2026-08-28 flight profiling convicted the SVG-filter
 * half of that approach — react-native-svg filters sample their
 * backdrop, so every frame of the capsule<->card morph re-rendered the
 * shells through CoreImage on the main thread — and the whole family
 * moved to baked chrome.
 *
 * Content is the Pro's (../ProDevice/scenes — the Touch runs the same
 * screens), laid out on the Pro's 288x484 canvas and paint-scaled into
 * the window by height (the two aspects differ by under 1%; the 3.6pt
 * of face left either side is below anything the device is drawn at).
 * The scenes composite over the face color, so the one scene that
 * repaints the bare panel — the passphrase grille — is built for this
 * face (see TOUCH_FACE and ../ProDevice/scenes createScenes).
 */

const DEVICE_W = 1044;
const DEVICE_H = 1751;

/** The glass face color — also the panel every scene composites over. */
export const TOUCH_FACE = '#151515';

/** The screen window inside the face (the design's Screen frame). */
const SCREEN_LEFT = 119;
const SCREEN_TOP = 120;
const SCREEN_W = 801;
const SCREEN_H = 1334;
/** The Pro canvas scaled into the window by height, centred. */
const CONTENT_SCALE = SCREEN_H / PRO_SCREEN_H;

/**
 * Animation contract of the Touch: the presence engine's one screen
 * opacity — the Pro's contract, the Touch has no face keys either.
 */
export type ITouchDeviceAnimation = IDeviceScreenAnimation;

const VALUE_OFF = makeMutable(0);
const VALUE_ON = makeMutable(1);
// Static fallbacks for animation-less usages, mirroring the sibling statics.
export const TOUCH_DEVICE_SCREEN_OFF: ITouchDeviceAnimation = {
  screenContent: VALUE_OFF,
};
export const TOUCH_DEVICE_SCREEN_ON: ITouchDeviceAnimation = {
  screenContent: VALUE_ON,
};

// The model suffix keeps the filename unique: webpack/rspack dev emits
// assets as bare [name].[ext], where same-named files overwrite each other.
const SHELL_SOURCE = require('./shell-touch.png');

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  device: {
    width: DEVICE_W,
    height: DEVICE_H,
  },
  // The window: no fill of its own, it only clips the content.
  screen: {
    position: 'absolute',
    left: SCREEN_LEFT,
    top: SCREEN_TOP,
    width: SCREEN_W,
    height: SCREEN_H,
    overflow: 'hidden',
  },
  // The Pro canvas, centred in the window and scaled about its centre.
  content: {
    position: 'absolute',
    left: (SCREEN_W - PRO_SCREEN_W) / 2,
    top: (SCREEN_H - PRO_SCREEN_H) / 2,
    width: PRO_SCREEN_W,
    height: PRO_SCREEN_H,
    transform: [{ scale: CONTENT_SCALE }],
  },
});

// Memoized like the sibling bodies: it must only re-render when the scene
// actually changes.
const DeviceBody = memo(function DeviceBody({
  animation,
  screenContent,
}: {
  animation: ITouchDeviceAnimation;
  screenContent?: ReactNode;
}) {
  const litStyle = useAnimatedStyle(
    () => ({ opacity: animation.screenContent.value }),
    [animation],
  );
  const contentStyle = useMemo(() => [styles.content, litStyle], [litStyle]);
  return (
    <>
      <BakedChrome source={SHELL_SOURCE} width={DEVICE_W} height={DEVICE_H} />
      <View style={styles.screen}>
        {screenContent ? (
          <Animated.View pointerEvents="none" style={contentStyle}>
            {screenContent}
          </Animated.View>
        ) : null}
      </View>
    </>
  );
});

export interface ITouchDeviceShellProps {
  /**
   * Rendered width in points. Height follows the fixed 1044:1751 aspect
   * ratio; the canvas is the Figma node's own size, so every realistic
   * width shrinks it.
   */
  width?: number;
  /**
   * Node lit in the screen window, authored on the Pro's 288x484 canvas.
   * Keep it referentially stable (a module constant or useMemo): the body
   * memoizes on it.
   */
  screenContent?: ReactNode;
  /**
   * Scene-produced animation contract. Omitted: a bare shell keeps the
   * screen dark; with screenContent it shows steady-on.
   */
  animation?: ITouchDeviceAnimation;
}

export function TouchDeviceShell({
  width = DEVICE_W / 3,
  screenContent,
  animation,
}: ITouchDeviceShellProps) {
  const scale = width / DEVICE_W;
  const resolvedAnimation =
    animation ??
    (screenContent ? TOUCH_DEVICE_SCREEN_ON : TOUCH_DEVICE_SCREEN_OFF);
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
