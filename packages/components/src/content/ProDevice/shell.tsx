import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { G, Path, Svg } from 'react-native-svg';

import { LinearGradient } from '../LinearGradient';

import { PRO_DEVICE_SCREEN_OFF, PRO_DEVICE_SCREEN_ON } from './animation';

import type { IProDeviceAnimation } from './animation';

/**
 * PoC: code-drawn OneKey Pro device, 1:1 against Figma node 20320:27410
 * (350x569 @1x: a 346-wide body plus the 4pt power tab on the right edge).
 * Not exported from the components barrel yet.
 *
 * Every value is transcribed from the raw Figma node dump (same workflow as
 * ../ClassicDevice). Unlike the Classic, the Pro spec has no NOISE and no
 * LAYER_BLUR, so the whole device is plain Views plus one Svg for the
 * wordmark - no filters anywhere.
 *
 * Two findings baked in, both profile-verified against the Figma render:
 * - The body's 1px INSIDE black stroke paints *above* its inner shadows
 *   (Figma's outermost ring is pure black over the rim lights), so it is the
 *   topmost entry of the rim boxShadow rather than a border.
 * - The bottom black shade (Figma offset -1 / spread 1) nets out to the two
 *   bottom rows, the outer one hidden by the stroke; it is transcribed as
 *   offset -2 / no spread, which measures identical.
 *
 * The rim inner shadows use spread distances (6, 2.5, 1), which the Classic
 * never needed - first in-repo use of inset boxShadow spread on native,
 * verified on an iOS 26.5 simulator against the Figma render.
 *
 * Plain RN View + StyleSheet rather than Tamagui Stack is forced, not
 * stylistic: @tamagui/web lists `boxShadow` in webPropsToSkip.native, so a
 * Stack drops every shadow layer on iOS and Android. Sizing reuses the
 * Classic's paint-only transform; with no blur filters involved, scaling has
 * no sigma caveat here - only the wordmark rasterizes above 1x on native.
 *
 * Animation attaches through two optional props: `screenContent` fills the
 * 288x484 touchscreen, `animation` (see ./animation.ts) drives the screen
 * power pair. Tap feedback lives inside scene screen content - the Pro has
 * no face keys. Everything animated is opacity only.
 *
 * The Figma screen is empty, so it says nothing about where content sits in
 * the stack; the device does. Its three white layers split by which side of
 * the glass they are on: the reflection film and the wake glow are light on
 * the outside, so they paint above `screenContent`, while the Screen frame's
 * own fill is the panel surface and is baked into the opaque panel color
 * underneath it.
 */

const DEVICE_W = 350;
const DEVICE_H = 569;
const BODY_W = 346;

/** Touchscreen size; scene screen content is laid out on this canvas. */
export const PRO_SCREEN_W = 288;
export const PRO_SCREEN_H = 484;

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  device: {
    width: DEVICE_W,
    height: DEVICE_H,
  },
  body: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BODY_W,
    height: DEVICE_H,
    borderRadius: 20,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  // Metal rim, top to bottom: 1px inside stroke over 1px top catch light,
  // 2px bottom shade, then the two soft light bands (2.5px blurred, 6px hard).
  bodyRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    boxShadow:
      'inset 0 0 0 1px #000,' +
      ' inset 0 1px 0 1px rgba(255,255,255,0.5),' +
      ' inset 0 -2px 0 0 rgba(0,0,0,0.2),' +
      ' inset 0 0 1px 2.5px rgba(255,255,255,0.2),' +
      ' inset 0 0 0 6px rgba(255,255,255,0.2)',
  },
  // Square-cornered glass, opaque so the body sheen cannot show through from
  // underneath. #0D0D0D is black carrying the Screen frame's own white 5%
  // fill (0.05 * 255 = 12.75 -> 13): that fill is the panel surface the UI is
  // drawn on, so it belongs under the content. The light that belongs *on*
  // the glass goes above it - see GLASS_FILM_COLORS.
  screen: {
    position: 'absolute',
    left: 29,
    top: 26,
    width: PRO_SCREEN_W,
    height: PRO_SCREEN_H,
    backgroundColor: '#0D0D0D',
    overflow: 'hidden',
  },
  // The lit panel's light, read off the glass rather than out of the UI, so
  // it washes the content too. Kept subtle: the Lottie's lit screen is a
  // near-black #101112 UI, so the content is the signal, not the lift.
  screenGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  screenSlot: {
    ...StyleSheet.absoluteFillObject,
  },
  // Recess seam of the cutout. Topmost, like the bezel edge it stands for:
  // it darkens the film rather than being washed out by it. A plain View,
  // not the LinearGradient - Tamagui drops boxShadow on native.
  screenSeam: {
    ...StyleSheet.absoluteFillObject,
    boxShadow: 'inset 0 0 1px 1px rgba(0,0,0,0.5)',
  },
  logo: {
    position: 'absolute',
    left: 140,
    top: 520,
  },
  // Side power button: #000 + white 20% = #333, lit at both ends, 1px dark
  // seam against the body.
  power: {
    position: 'absolute',
    left: BODY_W,
    top: 72,
    width: 4,
    height: 101,
    backgroundColor: '#333333',
    boxShadow:
      'inset 0 2px 2px rgba(255,255,255,0.25),' +
      ' inset 0 -2px 2px rgba(255,255,255,0.25),' +
      ' inset 1px 0 0 rgba(0,0,0,0.25)',
  },
});

const ABSOLUTE_FILL = { ...StyleSheet.absoluteFillObject };
const GRAD_BOTTOM = { x: 0.5, y: 1 } as const;
const GRAD_TOP = { x: 0.5, y: 0 } as const;
const BODY_SHEEN_COLORS = ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0)'];

// Reflection film: the body's white-10% top-down sheen as it falls across the
// screen band (body y 26..510 of 569), so alpha 0.1 * (1 - y/569) sampled at
// both edges. This is light on the outer glass, so it paints above the UI -
// the Screen frame's own flat 5% does not, it is baked into the panel color
// instead. Splitting the two rather than merging them keeps the panel tint off
// the content: the veil over the keyboard drops from ~6% to ~1%, which is what
// keeps brand green reading as brand green down there.
//
// The decimals record the derivation, not precision anything can paint: alpha
// is quantized to 8 bits by processColor on native and further to 2 decimals
// by react-native-web's normalizeColor, so the screen-off composite is
// preserved to within 1/255, not bit-exactly.
const GLASS_FILM_COLORS = [
  'rgba(255,255,255,0.09543)',
  'rgba(255,255,255,0.01037)',
];

// "OneKey" wordmark, paths verbatim from the Figma SVG export (opacity of the
// LogoType frame baked into the group by the export).
const LOGOTYPE = (
  <Svg
    width={67}
    height={27}
    viewBox="0 0 67 27"
    fill="none"
    style={styles.logo}
  >
    <G opacity={0.3}>
      <Path
        d="M6.61181 20.0933C5.40519 20.0933 4.29706 19.8081 3.28744 19.2378C2.27781 18.6675 1.4775 17.8803 0.8865 16.8761C0.2955 15.8595 0 14.7127 0 13.4358C0 12.1712 0.2955 11.0368 0.8865 10.0326C1.4775 9.01604 2.27781 8.22259 3.28744 7.65231C4.29706 7.08202 5.40519 6.79688 6.61181 6.79688C7.83075 6.79688 8.93888 7.08202 9.93619 7.65231C10.9458 8.22259 11.74 9.01604 12.3187 10.0326C12.9097 11.0368 13.2052 12.1712 13.2052 13.4358C13.2052 14.7127 12.9097 15.8595 12.3187 16.8761C11.74 17.8803 10.9458 18.6675 9.93619 19.2378C8.92656 19.8081 7.81844 20.0933 6.61181 20.0933ZM6.61181 17.7687C7.3875 17.7687 8.07084 17.5952 8.66184 17.248C9.25284 16.8885 9.71456 16.3802 10.047 15.7231C10.3794 15.0661 10.5457 14.3036 10.5457 13.4358C10.5457 12.5679 10.3794 11.8117 10.047 11.167C9.71456 10.5099 9.25284 10.0078 8.66184 9.66071C8.07084 9.31358 7.3875 9.14002 6.61181 9.14002C5.83612 9.14002 5.14663 9.31358 4.54331 9.66071C3.95231 10.0078 3.49059 10.5099 3.15816 11.167C2.82572 11.8117 2.6595 12.5679 2.6595 13.4358C2.6595 14.3036 2.82572 15.0661 3.15816 15.7231C3.49059 16.3802 3.95231 16.8885 4.54331 17.248C5.14663 17.5952 5.83612 17.7687 6.61181 17.7687Z"
        fill="#fff"
      />
      <Path
        d="M19.8753 9.51194C21.0942 9.51194 22.0792 9.90247 22.8303 10.6835C23.5813 11.4522 23.9569 12.5307 23.9569 13.9193V19.9631H21.3712V14.2726C21.3712 13.4544 21.1681 12.8283 20.7618 12.3944C20.3554 11.9481 19.8014 11.7249 19.0996 11.7249C18.3854 11.7249 17.8191 11.9481 17.4004 12.3944C16.9941 12.8283 16.791 13.4544 16.791 14.2726V19.9631H14.2054V9.66071H16.791V10.9439C17.1357 10.4975 17.5728 10.1504 18.1023 9.90247C18.644 9.64212 19.235 9.51194 19.8753 9.51194Z"
        fill="#fff"
      />
      <Path
        d="M35.1883 14.5887C35.1883 14.9607 35.1637 15.2954 35.1144 15.5929H27.6346C27.6961 16.3368 27.9547 16.9195 28.4103 17.341C28.8658 17.7625 29.4261 17.9733 30.0909 17.9733C31.0513 17.9733 31.7346 17.558 32.141 16.7273H34.9297C34.6342 17.7191 34.0679 18.5374 33.2306 19.182C32.3934 19.8143 31.3653 20.1305 30.1463 20.1305C29.1613 20.1305 28.2748 19.9135 27.4868 19.4796C26.7111 19.0333 26.1017 18.4072 25.6584 17.6014C25.2275 16.7955 25.012 15.8657 25.012 14.8119C25.012 13.7457 25.2275 12.8097 25.6584 12.0039C26.0894 11.198 26.6927 10.5781 27.4684 10.1442C28.2441 9.7103 29.1367 9.49335 30.1463 9.49335C31.119 9.49335 31.9871 9.7041 32.7504 10.1256C33.5261 10.5471 34.1233 11.1484 34.5419 11.9295C34.9728 12.6981 35.1883 13.5845 35.1883 14.5887ZM32.5103 13.8449C32.498 13.1754 32.2579 12.6423 31.7901 12.2456C31.3222 11.8365 30.7496 11.6319 30.0725 11.6319C29.4322 11.6319 28.8905 11.8303 28.4472 12.227C28.0163 12.6113 27.7516 13.1506 27.6531 13.8449H32.5103Z"
        fill="#fff"
      />
      <Path
        d="M43.7982 19.9631L39.1071 14.1796V19.9631H36.5215V6.98284H39.1071V12.8035L43.7982 6.98284H46.9194L41.6004 13.4172L47.0672 19.9631H43.7982Z"
        fill="#fff"
      />
      <Path
        d="M56.2477 14.5887C56.2477 14.9607 56.2231 15.2954 56.1739 15.5929H48.694C48.7556 16.3368 49.0141 16.9195 49.4697 17.341C49.9253 17.7625 50.4855 17.9733 51.1504 17.9733C52.1107 17.9733 52.7941 17.558 53.2004 16.7273H55.9892C55.6937 17.7191 55.1273 18.5374 54.29 19.182C53.4528 19.8143 52.4247 20.1305 51.2058 20.1305C50.2208 20.1305 49.3343 19.9135 48.5463 19.4796C47.7706 19.0333 47.1611 18.4072 46.7179 17.6014C46.2869 16.7955 46.0714 15.8657 46.0714 14.8119C46.0714 13.7457 46.2869 12.8097 46.7179 12.0039C47.1488 11.198 47.7521 10.5781 48.5278 10.1442C49.3035 9.7103 50.1961 9.49335 51.2058 9.49335C52.1784 9.49335 53.0465 9.7041 53.8099 10.1256C54.5855 10.5471 55.1827 11.1484 55.6013 11.9295C56.0323 12.6981 56.2477 13.5845 56.2477 14.5887ZM53.5698 13.8449C53.5574 13.1754 53.3174 12.6423 52.8495 12.2456C52.3816 11.8365 51.8091 11.6319 51.1319 11.6319C50.4916 11.6319 49.9499 11.8303 49.5066 12.227C49.0757 12.6113 48.811 13.1506 48.7125 13.8449H53.5698Z"
        fill="#fff"
      />
      <Path
        d="M67 9.66071L60.6652 24.8353H57.9134L60.1296 19.7027L56.0296 9.66071H58.9292L61.5702 16.8575L64.2482 9.66071H67Z"
        fill="#fff"
      />
    </G>
  </Svg>
);

// Memoized like the Classic's DeviceBody: scenes keep both props referentially
// stable, so the chrome only re-renders when the scene actually changes.
const DeviceBody = memo(function DeviceBody({
  animation,
  screenContent,
}: {
  animation: IProDeviceAnimation;
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
      <View style={styles.body}>
        <LinearGradient
          colors={BODY_SHEEN_COLORS}
          start={GRAD_TOP}
          end={GRAD_BOTTOM}
          style={ABSOLUTE_FILL}
        />
        <View style={styles.screen}>
          {screenContent ? (
            <Animated.View pointerEvents="none" style={slotLayerStyle}>
              {screenContent}
            </Animated.View>
          ) : null}
          {/* Everything below is light on the glass, so it stays above
              whatever the panel is showing: the lit panel's own wash, then
              the reflected film, then the recess seam. */}
          <Animated.View pointerEvents="none" style={glowLayerStyle} />
          <LinearGradient
            pointerEvents="none"
            colors={GLASS_FILM_COLORS}
            start={GRAD_TOP}
            end={GRAD_BOTTOM}
            style={ABSOLUTE_FILL}
          />
          <View pointerEvents="none" style={styles.screenSeam} />
        </View>
        {LOGOTYPE}
        {/* Figma frame inner shadows render above children. */}
        <View pointerEvents="none" style={styles.bodyRim} />
      </View>
      <View style={styles.power} />
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
  // against a stable frame. Same pattern as ClassicDeviceShell.
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
