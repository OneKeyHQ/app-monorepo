import type { ReactNode } from 'react';
import { memo, useMemo } from 'react';

import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Defs, Pattern, Rect, Svg, Image as SvgImage } from 'react-native-svg';

import { BakedChrome } from '../deviceSceneHost';
import { LinearGradient } from '../LinearGradient';

import {
  CLASSIC_DEVICE_SCREEN_OFF,
  CLASSIC_DEVICE_SCREEN_ON,
  PRESS_RELEASED,
} from './animation';
import { DownIcon, OkIcon, PowerIcon, UpIcon } from './icons';

import type { IClassicDeviceAnimation } from './animation';
import type { SharedValue } from 'react-native-reanimated';

/**
 * OneKey Classic device, 1:1 against Figma node 20249:27326 (327x539
 * @1x, the 2026-07-30 "After" revision). The chrome — body, noise
 * grain, ambient top light, screen bevels, USB cutout and bottom fade —
 * ships as a pre-baked bitmap (shell-classic@2x/@3x, exported straight from the
 * Figma frame at 280pt, the stage's largest rendering). Two things stay
 * code, because they move:
 *
 * - The screen: glass, panel glow and the 256x128 OLED slot (dynamic
 *   content), plus the glass sheen that must paint ABOVE live content.
 *   The code glass covers the baked glass region opaquely, so the sheen
 *   renders exactly once.
 * - The four keys: the press choreography sinks the cap, swallows the
 *   top highlight and shades the face — opacity and transform per key —
 *   so hole, face, engraving and press layers are all live. The baked
 *   chrome carries no keys at all (the export drops that group), and
 *   each face re-wears the noise grain as a tiled overlay so the keys
 *   keep the body's texture.
 *
 * The chrome was first transcribed as code-drawn SVG and shadow views
 * (see git history for the transcription rules and the sigma
 * quantization). The 2026-08-28 flight profiling convicted that
 * approach: react-native-svg filters sample their backdrop, so every
 * frame of the capsule<->card morph re-rendered the shells through
 * CoreImage on the main thread — and the whole family moved to baked
 * chrome, which also restores the design's exact blur radii.
 *
 * Animation attaches through two optional props: `screenContent` fills
 * the 256x128 OLED area, `animation` (see ./animation.ts) drives the
 * screen power pair and the per-key press value. Everything animated is
 * opacity or transform only.
 */

const DEVICE_W = 327;
const DEVICE_H = 539;

/**
 * The glass panel inside the screen hole. Scenes sweeping "the whole
 * screen" cover exactly this box; the glass's own overflow clips them.
 */
export const SCREEN_GLASS_W = 264;
export const SCREEN_GLASS_H = 152;
/** Insets of the lit 256x128 panel within the glass; content starts here. */
export const SCREEN_SLOT_LEFT = 4;
export const SCREEN_SLOT_TOP = 12;

const NOISE_TILE_SOURCE = require('./noise-tile.png');
// The model suffix keeps the filename unique: webpack/rspack dev emits
// assets as bare [name].[ext], where same-named files overwrite each other.
const SHELL_SOURCE = require('./shell-classic.png');
const NOISE_TILE_SIZE = 128;

// Tiled through an SVG <Pattern> rather than an Image: RN core's
// resizeMode="repeat" paints nothing at all under the new architecture
// (the asset loads, the view stays empty) — same finding as
// packages/kit/src/components/DotMap/plate.tsx, and the reason the
// pre-bitmap body overlay already used this shape. A pattern fill
// carries no filters, so none of the per-frame filter cost the baked
// chrome removed comes back. Built once at module scope: it takes no
// props, and react-native-svg re-runs transform/viewBox extraction on
// every render.
const KEY_NOISE_OVERLAY = (
  <Svg
    width="100%"
    height="100%"
    style={StyleSheet.absoluteFill}
    pointerEvents="none"
  >
    <Defs>
      <Pattern
        id="cd-key-noise"
        patternUnits="userSpaceOnUse"
        width={NOISE_TILE_SIZE}
        height={NOISE_TILE_SIZE}
      >
        <SvgImage
          href={NOISE_TILE_SOURCE}
          width={NOISE_TILE_SIZE}
          height={NOISE_TILE_SIZE}
        />
      </Pattern>
    </Defs>
    <Rect x="0" y="0" width="100%" height="100%" fill="url(#cd-key-noise)" />
  </Svg>
);

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  device: {
    width: DEVICE_W,
    height: DEVICE_H,
  },
  screenHole: {
    position: 'absolute',
    left: 24,
    top: 42,
    width: 278,
    height: 166,
  },
  screen: {
    position: 'absolute',
    left: 7,
    top: 7,
    width: SCREEN_GLASS_W,
    height: SCREEN_GLASS_H,
    borderRadius: 2,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  // Powered-on-but-empty panel: a faint luminance field across the whole glass.
  screenGlow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  // The lit 128x64 OLED grid at an integer 2x, centred in the glass.
  screenSlot: {
    position: 'absolute',
    left: SCREEN_SLOT_LEFT,
    top: SCREEN_SLOT_TOP,
    width: 256,
    height: 128,
  },
  buttons: {
    position: 'absolute',
    left: 33,
    top: 233,
    flexDirection: 'row',
    gap: 7,
  },
  btnHole: {
    width: 60,
    height: 60,
    borderRadius: 30,
    padding: 1,
    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.5)',
  },
  btnFace: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#262626',
    overflow: 'hidden',
  },
  absFill: {
    ...StyleSheet.absoluteFill,
  },
  btnIcon: {
    position: 'absolute',
    left: 15,
    top: 15,
  },
  btnHighlight: {
    ...StyleSheet.absoluteFill,
    borderRadius: 29,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
  },
  // Press layers: the face falls into shade and the hole lip casts onto the
  // sunken cap. Both sit above the highlight, below nothing.
  pressDark: {
    ...StyleSheet.absoluteFill,
    borderRadius: 29,
    backgroundColor: '#000',
  },
  pressShade: {
    ...StyleSheet.absoluteFill,
    borderRadius: 29,
    boxShadow:
      'inset 0 2px 3px rgba(0,0,0,0.5), inset 0 -1px 1px rgba(255,255,255,0.05)',
  },
});

// The gradient wrapper runs style through Tamagui's usePropsAndStyle, which
// expects a plain object - StyleSheet.absoluteFill is a registered id (a
// number) on native.
const ABSOLUTE_FILL = { ...StyleSheet.absoluteFill };
const FLEX_FILL = { flex: 1 };

const GRAD_BOTTOM = { x: 0.5, y: 1 } as const;
const GRAD_TOP = { x: 0.5, y: 0 } as const;
// Button face fills (bottom-up in Figma order): white lower-half glow 10%,
// black upper-half shade 10%, both meeting at 49.52%.
const BTN_GLOW_COLORS = ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0)'];
const BTN_GLOW_LOCATIONS = [0, 0.4952] as const;
const BTN_SHADE_COLORS = ['rgba(0,0,0,0)', 'rgba(0,0,0,0.1)'];
const BTN_SHADE_LOCATIONS = [0.4952, 1] as const;
// Screen glass sheen: white 8% at the top fading out downwards.
const SCREEN_SHEEN_COLORS = ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)'];

const POWER_ICON = <PowerIcon />;
const UP_ICON = <UpIcon />;
const DOWN_ICON = <DownIcon />;
const OK_ICON = <OkIcon />;

function DeviceButton({
  press,
  children,
}: {
  press: Readonly<SharedValue<number>>;
  children: ReactNode;
}) {
  // Physical key press, decomposed into light. As `press` goes 0 -> 1: the cap
  // (with its engraving) sinks 1.5pt, the hole lip swallows the crisp top
  // highlight and casts a shadow onto the sunken face, and the face falls into
  // shade. Opacity and transform only.
  const glowDimStyle = useAnimatedStyle(
    () => ({ opacity: 1 - 0.3 * press.value }),
    [press],
  );
  const sinkStyle = useAnimatedStyle(
    () => ({ transform: [{ translateY: 1.5 * press.value }] }),
    [press],
  );
  const highlightStyle = useAnimatedStyle(
    () => ({ opacity: 1 - 0.75 * press.value }),
    [press],
  );
  const faceDarkStyle = useAnimatedStyle(
    () => ({ opacity: 0.12 * press.value }),
    [press],
  );
  const lipShadowStyle = useAnimatedStyle(
    () => ({ opacity: press.value }),
    [press],
  );
  const glowLayerStyle = useMemo(
    () => [styles.absFill, glowDimStyle],
    [glowDimStyle],
  );
  const iconLayerStyle = useMemo(
    () => [styles.btnIcon, sinkStyle],
    [sinkStyle],
  );
  const highlightLayerStyle = useMemo(
    () => [styles.btnHighlight, highlightStyle],
    [highlightStyle],
  );
  const darkLayerStyle = useMemo(
    () => [styles.pressDark, faceDarkStyle],
    [faceDarkStyle],
  );
  const shadeLayerStyle = useMemo(
    () => [styles.pressShade, lipShadowStyle],
    [lipShadowStyle],
  );
  return (
    // "Button hole": no fill, 1px INSIDE stroke black 50% (an inset ring, so
    // the 58pt face keeps its (1,1) offset - border+padding would double it).
    <View style={styles.btnHole}>
      <View style={styles.btnFace}>
        <Animated.View pointerEvents="none" style={glowLayerStyle}>
          <LinearGradient
            colors={BTN_GLOW_COLORS}
            locations={BTN_GLOW_LOCATIONS}
            start={GRAD_BOTTOM}
            end={GRAD_TOP}
            style={FLEX_FILL}
          />
        </Animated.View>
        <LinearGradient
          colors={BTN_SHADE_COLORS}
          locations={BTN_SHADE_LOCATIONS}
          start={GRAD_BOTTOM}
          end={GRAD_TOP}
          style={ABSOLUTE_FILL}
        />
        {/* Absolute, not flex-centred: on web a static child paints beneath
            positioned siblings regardless of DOM order, so the icon would
            fall under the two gradient overlays. */}
        <Animated.View style={iconLayerStyle}>{children}</Animated.View>
        {/* The body's noise grain, re-worn: the baked chrome carries the
            grain everywhere but here (the export drops the key group), and
            a face without grain would read smoother than the body.
            Above the engraving like the old full-body overlay was. */}
        {KEY_NOISE_OVERLAY}
        {/* INNER_SHADOW 0 1 0 white 25%: crisp 1px top highlight */}
        <Animated.View pointerEvents="none" style={highlightLayerStyle} />
        <Animated.View pointerEvents="none" style={darkLayerStyle} />
        <Animated.View pointerEvents="none" style={shadeLayerStyle} />
      </View>
    </View>
  );
}

// Memoized like the sibling bodies: it must only re-render when the scene
// actually changes. Scenes keep both props referentially stable.
const DeviceBody = memo(function DeviceBody({
  animation,
  screenContent,
}: {
  animation: IClassicDeviceAnimation;
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
      <View style={styles.screenHole}>
        <View style={styles.screen}>
          <Animated.View pointerEvents="none" style={glowLayerStyle} />
          {screenContent ? (
            <Animated.View pointerEvents="none" style={slotLayerStyle}>
              {screenContent}
            </Animated.View>
          ) : null}
          {/* Glass reflection stays above whatever the panel shows. */}
          <LinearGradient
            colors={SCREEN_SHEEN_COLORS}
            start={GRAD_TOP}
            end={GRAD_BOTTOM}
            style={ABSOLUTE_FILL}
          />
        </View>
      </View>

      <View style={styles.buttons}>
        <DeviceButton press={animation.press?.power ?? PRESS_RELEASED}>
          {POWER_ICON}
        </DeviceButton>
        <DeviceButton press={animation.press?.up ?? PRESS_RELEASED}>
          {UP_ICON}
        </DeviceButton>
        <DeviceButton press={animation.press?.down ?? PRESS_RELEASED}>
          {DOWN_ICON}
        </DeviceButton>
        <DeviceButton press={animation.press?.ok ?? PRESS_RELEASED}>
          {OK_ICON}
        </DeviceButton>
      </View>
    </>
  );
});

export interface IClassicDeviceShellProps {
  /**
   * Rendered width in points. Height follows the fixed 327:539 aspect ratio.
   */
  width?: number;
  /**
   * Node lit on the 256x128 OLED area (an integer 2x of the 128x64 panel).
   * Keep it referentially stable (a module constant or useMemo): the body
   * memoizes on it.
   */
  screenContent?: ReactNode;
  /**
   * Scene-produced animation contract (see ./animation.ts). Omitted: a bare
   * shell keeps the screen dark; with screenContent it shows steady-on.
   */
  animation?: IClassicDeviceAnimation;
}

export function ClassicDeviceShell({
  width = DEVICE_W,
  screenContent,
  animation,
}: IClassicDeviceShellProps) {
  const scale = width / DEVICE_W;
  const resolvedAnimation =
    animation ??
    (screenContent ? CLASSIC_DEVICE_SCREEN_ON : CLASSIC_DEVICE_SCREEN_OFF);
  // The outer frame carries the true layout size, because a transform is
  // paint-only - Yoga never sees it, so a bare scaled view would still reserve
  // its unscaled 327x539 box and overlap its siblings.
  const frameStyle = useMemo(
    () => [styles.frame, { width: DEVICE_W * scale, height: DEVICE_H * scale }],
    [scale],
  );
  // The explicit 327x539 on the scaled view is required, not cosmetic:
  // transformOrigin resolves against layoutMetrics.frame.size, and the default
  // alignItems: 'stretch' would otherwise skew the origin.
  const bodyStyle = useMemo(
    () => [styles.device, { transform: [{ scale }] }],
    [scale],
  );
  return (
    <View style={frameStyle}>
      <View style={bodyStyle}>
        <DeviceBody
          animation={resolvedAnimation}
          screenContent={screenContent}
        />
      </View>
    </View>
  );
}
