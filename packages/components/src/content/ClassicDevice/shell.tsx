import type { ReactNode } from 'react';
import { memo, useMemo } from 'react';

import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import {
  ClipPath,
  Defs,
  FeGaussianBlur,
  Filter,
  G,
  Path,
  Pattern,
  Rect,
  Stop,
  Svg,
  Image as SvgImage,
  LinearGradient as SvgLinearGradient,
} from 'react-native-svg';

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
 * PoC: code-drawn OneKey Classic device, 1:1 against Figma node 20069:31306
 * (327x539 @1x). Not exported from the components barrel yet.
 *
 * Every value is transcribed from the raw Figma node dump, not from the MCP
 * code translation (which silently drops the NOISE effect and mistranslates
 * the button-hole INSIDE stroke). Two conversion rules apply:
 * LAYER_BLUR radius R -> gaussian sigma R/2; INNER_SHADOW radius -> blur 1:1.
 *
 * Two things here had no in-repo precedent and were verified on an iOS 26.5
 * simulator against the Figma render: multiple inset `boxShadow` entries on the
 * new architecture (the body ambient light), and react-native-svg
 * `FeGaussianBlur` (the screen bevels and the USB cutout).
 *
 * Plain RN View + StyleSheet rather than Tamagui Stack is forced, not stylistic:
 * @tamagui/web lists `boxShadow` in webPropsToSkip.native, so a Stack drops all
 * three shadow layers on iOS and Android.
 *
 * Sizing goes through a paint-only transform rather than parametric geometry
 * because scaling the SVG itself would break the blurs on iOS: the sigma passed
 * to CIGaussianBlur in the react-native-svg gaussian-blur filter is multiplied by the display
 * scale only, with no viewBox term, so geometry would scale while the blur did
 * not. That code also picks its filter with an NSNumber POINTER comparison
 * (`_stdDeviationX == _stdDeviationY`), which only holds for integers - a
 * fractional sigma silently degrades to CIMotionBlur. Keeping sigma at the
 * literal 1 and 3 sidesteps both. Cost of the transform: on iOS and Android the
 * SVG and the noise are magnified bitmaps above scale 1 (web stays vector), so
 * enlarging past roughly 1.3x visibly softens.
 *
 * Animation attaches through two optional props: `screenContent` fills the
 * 256x128 OLED area, `animation` (see ./animation.ts) drives the screen
 * power pair and the per-key press value. Everything animated is opacity or
 * transform only.
 */

const DEVICE_W = 327;
const DEVICE_H = 539;

/** Top inset of the lit panel within the glass; screen content starts here. */
export const SCREEN_SLOT_TOP = 12;

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  device: {
    width: DEVICE_W,
    height: DEVICE_H,
    borderRadius: 12,
    backgroundColor: '#2F3135',
    overflow: 'hidden',
  },
  bodyLight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    boxShadow:
      'inset -24px 0 24px rgba(255,255,255,0.1), inset 24px 0 24px rgba(255,255,255,0.1), inset 0 -24px 24px rgba(0,0,0,0.2), inset 0 24px 24px rgba(255,255,255,0.15)',
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
    width: 264,
    height: 152,
    borderRadius: 2,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  // Powered-on-but-empty panel: a faint luminance field across the whole glass.
  screenGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  // The lit 128x64 OLED grid at an integer 2x, centred in the glass.
  screenSlot: {
    position: 'absolute',
    left: 4,
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
    backgroundColor: '#2F3135',
    overflow: 'hidden',
  },
  absFill: {
    ...StyleSheet.absoluteFillObject,
  },
  btnIcon: {
    position: 'absolute',
    left: 15,
    top: 15,
  },
  btnHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 29,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
  },
  // Press layers: the face falls into shade and the hole lip casts onto the
  // sunken cap. Both sit above the highlight, below nothing.
  pressDark: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 29,
    backgroundColor: '#000',
  },
  pressShade: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 29,
    boxShadow:
      'inset 0 2px 3px rgba(0,0,0,0.5), inset 0 -1px 1px rgba(255,255,255,0.05)',
  },
  usb: {
    // 12pt = 4 sigma of the strongest blur, so the bleed is not clipped.
    position: 'absolute',
    left: 119,
    top: 460,
  },
});

// The gradient wrapper runs style through Tamagui's usePropsAndStyle, which
// expects a plain object - StyleSheet.absoluteFill is a registered id (a
// number) on native.
const ABSOLUTE_FILL = { ...StyleSheet.absoluteFillObject };
const FLEX_FILL = { flex: 1 };

const GRAD_BOTTOM = { x: 0.5, y: 1 } as const;
const GRAD_TOP = { x: 0.5, y: 0 } as const;
// Button face fills (bottom-up in Figma order): white lower-half glow 10%,
// black upper-half shade 10%, both meeting at 49.52%.
const BTN_GLOW_COLORS = ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0)'];
const BTN_GLOW_LOCATIONS = [0, 0.4952] as const;
const BTN_SHADE_COLORS = ['rgba(0,0,0,0)', 'rgba(0,0,0,0.1)'];
const BTN_SHADE_LOCATIONS = [0.4952, 1] as const;
// Screen glass sheen: white 20% at the top fading out downwards.
const SCREEN_SHEEN_COLORS = ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0)'];

// Monotone black grain, alpha U[0, 0.25], texel 0.5pt (Figma noiseSize 0.5).
// The tile carries a 256x256 grid of them across 128pt; @2x is that grid
// one-to-one, @1x its exact 2x2 box average, @3x area-weighted 1.5px per cell.
const NOISE_TILE = require('./noise-tile.png');
const NOISE_TILE_SIZE = 128;

// Tiled through an SVG <Pattern> rather than an Image: RN core's
// resizeMode="repeat" paints nothing at all under the new architecture (the
// asset loads, the view stays empty), and a device-sized stretched PNG costs
// 2.4MB and re-scales the grain with the device. Same approach, and the same
// resizeMode finding, as packages/kit/src/components/DotMap/plate.tsx.
// Built once at module scope - it takes no props and react-native-svg re-runs
// transform/viewBox extraction on every render.
const NOISE_OVERLAY = (
  <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
    <Defs>
      <Pattern
        id="cd-noise"
        patternUnits="userSpaceOnUse"
        width={NOISE_TILE_SIZE}
        height={NOISE_TILE_SIZE}
      >
        <SvgImage
          href={NOISE_TILE}
          width={NOISE_TILE_SIZE}
          height={NOISE_TILE_SIZE}
        />
      </Pattern>
    </Defs>
    <Rect x="0" y="0" width="100%" height="100%" fill="url(#cd-noise)" />
  </Svg>
);

// Mitered 45-degree bevels around the screen recess. Geometry and gradients
// verbatim from the Figma SVG export; the export's no-op feFlood/feBlend
// preamble is dropped - a single FeGaussianBlur is mathematically identical.
function ScreenBevels() {
  return (
    <Svg
      width={278}
      height={166}
      viewBox="0 0 278 166"
      fill="none"
      style={StyleSheet.absoluteFill}
    >
      <G clipPath="url(#cd-bevel-clip)">
        <G opacity={0.05} filter="url(#cd-bevel-fl)">
          <Path d="M0 0L7 7V159L0 166V0Z" fill="url(#cd-bevel-gl)" />
        </G>
        <G opacity={0.05} filter="url(#cd-bevel-fr)">
          <Path d="M278 0L271 7V159L278 166V0Z" fill="url(#cd-bevel-gr)" />
        </G>
        <G opacity={0.2} filter="url(#cd-bevel-ft)">
          <Path d="M278 0L271 7L7 7L0 0L278 0Z" fill="url(#cd-bevel-gt)" />
        </G>
        <G opacity={0.1} filter="url(#cd-bevel-fb)">
          <Path
            d="M278 166L271 159L7 159L0 166L278 166Z"
            fill="url(#cd-bevel-gb)"
          />
        </G>
      </G>
      <Defs>
        <Filter
          id="cd-bevel-fl"
          x={-2}
          y={-2}
          width={11}
          height={170}
          filterUnits="userSpaceOnUse"
        >
          <FeGaussianBlur stdDeviation={1} />
        </Filter>
        <Filter
          id="cd-bevel-fr"
          x={269}
          y={-2}
          width={11}
          height={170}
          filterUnits="userSpaceOnUse"
        >
          <FeGaussianBlur stdDeviation={1} />
        </Filter>
        <Filter
          id="cd-bevel-ft"
          x={-2}
          y={-2}
          width={282}
          height={11}
          filterUnits="userSpaceOnUse"
        >
          <FeGaussianBlur stdDeviation={1} />
        </Filter>
        <Filter
          id="cd-bevel-fb"
          x={-2}
          y={157}
          width={282}
          height={11}
          filterUnits="userSpaceOnUse"
        >
          <FeGaussianBlur stdDeviation={1} />
        </Filter>
        <SvgLinearGradient
          id="cd-bevel-gl"
          x1={7}
          y1={83}
          x2={0}
          y2={83}
          gradientUnits="userSpaceOnUse"
        >
          <Stop stopColor="#fff" stopOpacity={0.5} />
          <Stop offset={1} stopColor="#fff" />
        </SvgLinearGradient>
        <SvgLinearGradient
          id="cd-bevel-gr"
          x1={278}
          y1={83}
          x2={271}
          y2={83}
          gradientUnits="userSpaceOnUse"
        >
          <Stop stopColor="#fff" />
          <Stop offset={1} stopColor="#fff" stopOpacity={0.5} />
        </SvgLinearGradient>
        <SvgLinearGradient
          id="cd-bevel-gt"
          x1={139}
          y1={0}
          x2={139}
          y2={7}
          gradientUnits="userSpaceOnUse"
        >
          <Stop stopColor="#000" />
          <Stop offset={1} stopColor="#000" stopOpacity={0.5} />
        </SvgLinearGradient>
        <SvgLinearGradient
          id="cd-bevel-gb"
          x1={139}
          y1={166}
          x2={139}
          y2={159}
          gradientUnits="userSpaceOnUse"
        >
          <Stop stopColor="#fff" />
          <Stop offset={1} stopColor="#fff" stopOpacity={0.5} />
        </SvgLinearGradient>
        <ClipPath id="cd-bevel-clip">
          <Rect width={278} height={166} rx={4} />
        </ClipPath>
      </Defs>
    </Svg>
  );
}

const SCREEN_BEVELS = <ScreenBevels />;

// USB cutout: a blurred gradient glow (sigma 3) with the body color painted
// back on top (sigma 1), leaving a soft rim. The Figma "USB port" frame does
// not clip, so the 90x79 canvas pads the 66x67 art by 12pt (4 sigma) on
// top/left/right to let the blur bleed; the bottom edge coincides with the
// device bottom, where the body frame clips in Figma too. That 12 is baked
// into the path data and both filter regions below, so it is not a knob.
function UsbCutout() {
  return (
    <Svg
      width={90}
      height={79}
      viewBox="0 0 90 79"
      fill="none"
      style={styles.usb}
    >
      {/* Light effect: 66x67, top radius 20, white 2% (bottom) -> 8% (top) */}
      <Path
        d="M12 79V32C12 20.9543 20.9543 12 32 12H58C69.0457 12 78 20.9543 78 32V79Z"
        fill="url(#cd-usb-glow)"
        filter="url(#cd-usb-blur6)"
      />
      {/* Layer: 42x55 at (12,12), top radius 12, body color */}
      <Path
        d="M24 79V36C24 29.3726 29.3726 24 36 24H54C60.6274 24 66 29.3726 66 36V79Z"
        fill="#2F3135"
        filter="url(#cd-usb-blur2)"
      />
      <Defs>
        <Filter
          id="cd-usb-blur6"
          x={0}
          y={0}
          width={90}
          height={79}
          filterUnits="userSpaceOnUse"
        >
          <FeGaussianBlur stdDeviation={3} />
        </Filter>
        <Filter
          id="cd-usb-blur2"
          x={12}
          y={12}
          width={78}
          height={67}
          filterUnits="userSpaceOnUse"
        >
          <FeGaussianBlur stdDeviation={1} />
        </Filter>
        <SvgLinearGradient
          id="cd-usb-glow"
          x1={45}
          y1={79}
          x2={45}
          y2={12}
          gradientUnits="userSpaceOnUse"
        >
          <Stop stopColor="#fff" stopOpacity={0.02} />
          <Stop offset={1} stopColor="#fff" stopOpacity={0.08} />
        </SvgLinearGradient>
      </Defs>
    </Svg>
  );
}

// The static chrome is built once, like the noise: these are 71 of the body's
// 76 react-native-svg elements, and rn-svg re-runs transform/viewBox
// extraction on every render. Element constants keep them out of any
// re-render the DeviceBody memo does not absorb.
const USB_CUTOUT = <UsbCutout />;
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
        {/* INNER_SHADOW 0 1 0 white 25%: crisp 1px top highlight */}
        <Animated.View pointerEvents="none" style={highlightLayerStyle} />
        <Animated.View pointerEvents="none" style={darkLayerStyle} />
        <Animated.View pointerEvents="none" style={shadeLayerStyle} />
      </View>
    </View>
  );
}

// Memoized rather than a module constant (its pre-animation form): the body is
// 76 react-native-svg elements and rn-svg re-runs transform/viewBox extraction
// in render(), so it must only re-render when the scene actually changes.
// Scenes keep both props referentially stable.
const DeviceBody = memo(function DeviceBody({
  animation,
  screenContent,
}: {
  animation: IClassicDeviceAnimation;
  screenContent?: ReactNode;
}) {
  const glowStyle = useAnimatedStyle(
    () => ({ opacity: animation.screenGlow.value }),
    [animation],
  );
  const slotStyle = useAnimatedStyle(
    () => ({ opacity: animation.screenContent.value }),
    [animation],
  );
  const glowLayerStyle = useMemo(
    () => [styles.screenGlow, glowStyle],
    [glowStyle],
  );
  const slotLayerStyle = useMemo(
    () => [styles.screenSlot, slotStyle],
    [slotStyle],
  );
  return (
    <>
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
        {SCREEN_BEVELS}
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

      {USB_CUTOUT}
      {NOISE_OVERLAY}
      {/* Body ambient light: Figma frame inner shadows render above children,
          so this overlay is the last child, above the noise. */}
      <View pointerEvents="none" style={styles.bodyLight} />
    </>
  );
});

export interface IClassicDeviceShellProps {
  /**
   * Rendered width in points. Height follows the fixed 327:539 aspect ratio.
   * Shrinking is visually free; enlarging is fine to roughly 430 and softens
   * beyond that (see the scaling note above).
   */
  width?: number;
  /**
   * Node lit on the 256x128 OLED area (an integer 2x of the 128x64 panel).
   * Keep it referentially stable (a module constant or useMemo): the body
   * memoizes on it, and a fresh node re-renders all 76 SVG elements.
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
