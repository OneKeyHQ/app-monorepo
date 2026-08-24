import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import {
  Defs,
  FeGaussianBlur,
  Filter,
  G,
  Path,
  Rect,
  Svg,
} from 'react-native-svg';

import { PRO_DEVICE_SCREEN_OFF, PRO_DEVICE_SCREEN_ON } from './animation';

import type { IProDeviceAnimation } from './animation';

/**
 * PoC: code-drawn OneKey Pro device, 1:1 against Figma node 20620:967
 * (350x569 @1x: a 346-wide body plus the 4pt power tab on the right edge;
 * the 2026-08-12 shell revision - highlights and bottom shadow reworked -
 * of the original 20320:27410). Not exported from the components barrel yet.
 *
 * Every value is transcribed from the raw Figma node dump (same workflow as
 * ../ClassicDevice). The old recipe - five inner-shadow rim entries plus a
 * full-body sheen gradient - is gone from the spec: this revision paints a
 * flat black slab and puts all light into five explicit layers:
 *
 * - Glass: an inset-8 r12 plate, white 5% with a 1px black center-aligned
 *   seam stroke (an Svg Rect, not a View border, for the center alignment).
 *   It paints above the screen, so its fill IS the reflection film over
 *   whatever the panel shows - flat now, the gradient film retired with the
 *   body sheen it used to sample. The Screen frame's own white 5% stays
 *   baked into the panel color underneath, keeping the old split of light
 *   by which side of the glass it lives on. Screen-off glass composites to
 *   25/255, matching the Figma render.
 * - Frame edge light: a 2px white 75% stroke ring on the frame line (the
 *   inset-3 r17 rounded rect), Figma layer blur 5 - the one soft rim light.
 * - Frame top light and Glass top light: 1px white 25% crescents hugging
 *   the top edge and top corners of the frame line and the glass seam,
 *   tapering to nothing at the corner tangents. The taper lives in the path
 *   data, so both paths are transcribed verbatim rather than re-derived as
 *   strokes.
 * - Frame bottom shadow: a black crescent riding the frame line's bottom
 *   arc (2px mid-run, tapering into the corners), Figma layer blur 3. It
 *   sits above the edge light and eats it across the bottom, so the device
 *   grounds into shadow instead of sitting in an even ring of light.
 *
 * Blur quantization: iOS react-native-svg silently degrades fractional
 * FeGaussianBlur sigmas (see ../ClassicDevice), so every sigma is an
 * integer literal, chosen by pixel-fitting the Figma render rather than
 * blind radius/2 rounding. The edge light (sigma 2.5 nominal) renders at
 * 2: its peak lands 73/255 against 68 measured, while 3 dulls it to 47.
 * The bottom shadow (1.5 nominal) renders at 2, matching the measured
 * residual glow through the shade. The radius-1 top lights measure no
 * different from plain antialiasing in Figma's own raster, so both paint
 * crisp with no filter at all.
 *
 * This Figma revision nests the power button inside the clipping Body
 * frame, so Figma's own render drops it; the outer frame still reserves
 * the 4pt tab and the node keeps its full paint spec, so that is read as
 * an authoring accident and the tab stays rendered here, as a body
 * sibling, spec unchanged.
 *
 * Plain RN View + StyleSheet rather than Tamagui Stack is forced for the
 * power button, not stylistic: @tamagui/web lists `boxShadow` in
 * webPropsToSkip.native, so a Stack drops its shadow layers on iOS and
 * Android. Sizing reuses the Classic's paint-only transform, which with
 * blurs now in the tree inherits the Classic's caveat too: above 1x the
 * SVG layers magnify as bitmaps on native, so enlarging visibly softens;
 * shrinking is free.
 *
 * Animation attaches through two optional props: `screenContent` fills the
 * 288x484 touchscreen, `animation` (see ./animation.ts) drives the screen
 * content's opacity - the presence model shared with the Pro 2, so there
 * is no wake glow layer. Tap feedback lives inside scene screen content -
 * the Pro has no face keys. Everything animated is opacity only.
 */

const DEVICE_W = 350;
const DEVICE_H = 569;
const BODY_W = 346;

/** Touchscreen size; scene screen content is laid out on this canvas. */
export const PRO_SCREEN_W = 288;
export const PRO_SCREEN_H = 484;
/**
 * The screen panel surface (see `screen` below for the derivation) —
 * also what scene content composites over, so a scene repainting the
 * bare surface (the passphrase gap grille) uses this exact value.
 */
export const PRO_SCREEN_BG = '#0D0D0D';

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
  // Square-cornered panel, opaque so the rim glow cannot show through from
  // underneath. #0D0D0D is black carrying the Screen frame's own white 5%
  // fill (0.05 * 255 = 12.75 -> 13): that fill is the panel surface the UI
  // is drawn on, so it belongs under the content. The light that belongs
  // *on* the glass is the Glass plate's fill, painted above.
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
  logo: {
    position: 'absolute',
    left: 140,
    top: 520,
  },
  // Shell light layers: node origin minus the canvas padding noted on each.
  glass: {
    position: 'absolute',
    left: 7,
    top: 7,
  },
  glassTopLight: {
    position: 'absolute',
    left: 7,
    top: 6.5,
  },
  edgeLight: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  bottomShadow: {
    position: 'absolute',
    left: -3,
    top: 543,
  },
  frameTopLight: {
    position: 'absolute',
    left: 2,
    top: 1.5,
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

// The shell light layers take no props, so they are built once at module
// scope like the Classic's chrome - react-native-svg re-runs transform and
// viewBox extraction in render() otherwise. Each canvas pads its node rect
// (3 sigma where blurred, 1pt of antialias headroom where crisp) through a
// negative-origin viewBox, keeping Figma's path data verbatim; bleed past
// the body edge is clipped by the body, as Figma's Body frame clips too.

// Glass plate at (8,8) 330x553 r12: the flat reflection film and its seam.
const GLASS_PLATE = (
  <Svg
    pointerEvents="none"
    width={332}
    height={555}
    viewBox="0 0 332 555"
    fill="none"
    style={styles.glass}
  >
    <Rect
      x={1}
      y={1}
      width={330}
      height={553}
      rx={12}
      fill="#fff"
      fillOpacity={0.05}
      stroke="#000"
      strokeWidth={1}
    />
  </Svg>
);

// 1px catch light along the glass seam's top edge and corners, crisp.
const GLASS_TOP_LIGHT = (
  <Svg
    pointerEvents="none"
    width={332}
    height={14.5}
    viewBox="-1 -1 332 14.5"
    fill="none"
    style={styles.glassTopLight}
  >
    <Path
      d="M165.004 0 C216.004 0 267.004 0.132267 318.004 0.396484 C318.565 0.399424 319.122 0.439767 319.677 0.519531 C325.475 1.25059 330.154 6.70274 330.004 12.5 C330.083 6.69886 325.361 1.36466 319.651 0.708008 C319.104 0.635235 318.556 0.600704 318.004 0.603516 C267.004 0.867733 216.004 1 165.004 1 C114.004 1 63.0035 0.867733 12.0035 0.603516 C11.4511 0.600704 10.9035 0.635236 10.3561 0.708008 C4.64565 1.36466 -0.0760291 6.69887 0.00352227 12.5 C-0.146765 6.70274 4.53161 1.25059 10.3297 0.519531 C10.8851 0.439767 11.4416 0.399424 12.0035 0.396484 C63.0035 0.132267 114.004 0 165.004 0 Z"
      fill="#fff"
      opacity={0.25}
    />
  </Svg>
);

// The rim light: 2px white ring on the frame line, layer blur 5 -> sigma 2.
// Full-body canvas, so the outward bleed clips at the body edge like Figma.
const FRAME_EDGE_LIGHT = (
  <Svg
    pointerEvents="none"
    width={BODY_W}
    height={DEVICE_H}
    viewBox="0 0 346 569"
    fill="none"
    style={styles.edgeLight}
  >
    <G opacity={0.75} filter="url(#pd-edge-light-blur)">
      <Rect
        x={3}
        y={3}
        width={340}
        height={563}
        rx={17}
        fill="none"
        stroke="#fff"
        strokeWidth={2}
      />
    </G>
    <Defs>
      <Filter
        id="pd-edge-light-blur"
        x={0}
        y={0}
        width={346}
        height={569}
        filterUnits="userSpaceOnUse"
      >
        <FeGaussianBlur stdDeviation={2} />
      </Filter>
    </Defs>
  </Svg>
);

// Black crescent over the frame line's bottom arc, layer blur 3 -> sigma 2.
const FRAME_BOTTOM_SHADOW = (
  <Svg
    pointerEvents="none"
    width={352}
    height={30}
    viewBox="-6 -6 352 30"
    fill="none"
    style={styles.bottomShadow}
  >
    <G filter="url(#pd-bottom-shadow-blur)">
      <Path
        d="M340 0 C340.129 6.01563 336.734 11.9687 331.449 14.9736 C328.902 16.4524 325.961 17.2527 323 17.2754 C272 17.7586 221 18 170 18 C119 18 68 17.7586 17 17.2754 C14.0393 17.2527 11.0983 16.4526 8.55078 14.9736 C3.39909 12.0402 0.0295428 6.30809 0.000976562 0.438477 C0.000646175 0.292318 0.000326418 0.146159 0 0 C0.00357978 0.146137 0.0071675 0.292398 0.0107422 0.438477 C0.171853 6.30466 3.64491 11.8775 8.7373 14.6426 C11.2574 16.0387 14.132 16.7568 17 16.7246 C68 16.2414 119 16 170 16 C221 16 272 16.2414 323 16.7246 C325.868 16.7569 328.743 16.0385 331.263 14.6426 C336.486 11.8104 339.992 6.01949 340 0 Z"
        fill="#000"
      />
    </G>
    <Defs>
      <Filter
        id="pd-bottom-shadow-blur"
        x={-6}
        y={-6}
        width={352}
        height={30}
        filterUnits="userSpaceOnUse"
      >
        <FeGaussianBlur stdDeviation={2} />
      </Filter>
    </Defs>
  </Svg>
);

// 1px catch light along the frame line's top edge and corners, crisp.
const FRAME_TOP_LIGHT = (
  <Svg
    pointerEvents="none"
    width={342}
    height={19.5}
    viewBox="-1 -1 342 19.5"
    fill="none"
    style={styles.frameTopLight}
  >
    <Path
      d="M170.002 0 C221.002 0 272.002 0.120679 323.002 0.362305 C325.939 0.371231 328.864 1.15131 331.404 2.60938 C336.673 5.57108 340.097 11.4834 340.002 17.5 C340.028 11.4815 336.55 5.64978 331.311 2.77441 C328.785 1.35772 325.893 0.619173 323.002 0.637695 C272.002 0.879321 221.002 1 170.002 1 C119.002 1 68.0019 0.879321 17.0019 0.637695 C14.1107 0.619173 11.2191 1.35772 8.69235 2.77441 C3.45361 5.64978 -0.0245878 11.4815 0.00191685 17.5 C-0.0928025 11.4834 3.33035 5.57108 8.59957 2.60938 C11.14 1.1513 14.0644 0.371231 17.0019 0.362305 C68.0019 0.120679 119.002 0 170.002 0 Z"
      fill="#fff"
      opacity={0.25}
    />
  </Svg>
);

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
      <View style={styles.body}>
        <View style={styles.screen}>
          {screenContent ? (
            <Animated.View pointerEvents="none" style={slotLayerStyle}>
              {screenContent}
            </Animated.View>
          ) : null}
        </View>
        {LOGOTYPE}
        {/* Figma z order: the glass plate (film + seam) above the wordmark,
            the frame's edge light above the glass lights, the bottom shadow
            above the edge light it eats, the frame top light last. */}
        {GLASS_PLATE}
        {GLASS_TOP_LIGHT}
        {FRAME_EDGE_LIGHT}
        {FRAME_BOTTOM_SHADOW}
        {FRAME_TOP_LIGHT}
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
