import type { ReactNode } from 'react';
import { memo, useMemo } from 'react';

import { StyleSheet, View } from 'react-native';
import Animated, {
  makeMutable,
  useAnimatedStyle,
} from 'react-native-reanimated';
import {
  Circle,
  Defs,
  FeBlend,
  FeColorMatrix,
  FeComposite,
  FeFlood,
  FeGaussianBlur,
  FeOffset,
  Filter,
  G,
  Path,
  Svg,
} from 'react-native-svg';

import type { IDeviceScreenAnimation } from '../deviceSceneHost';
import type { ViewStyle } from 'react-native';

/**
 * Code-drawn OneKey Mini device, 1:1 against Figma node 21585:44511
 * (657x1419 on the canvas: a 651-wide white body plus the power tab on
 * the right edge). Not exported from the components barrel yet.
 *
 * Every value is transcribed from the node's SVG export (the MCP code
 * translation flattens the body to one bitmap). The shell is far simpler
 * than the Classic's — no noise, no bevels, no USB cutout — and breaks
 * into three kinds of paint:
 *
 *  - RN views with inset `boxShadow` for the body's edge vignette (the
 *    Figma INNER_SHADOW: spread 45, blur 173, black 10% — feMorphology,
 *    which the export uses for the spread, has no native implementation
 *    in react-native-svg) and the power tab's top light. Plain RN View +
 *    StyleSheet rather than Tamagui Stack is forced: @tamagui/web lists
 *    `boxShadow` in webPropsToSkip.native.
 *  - One SVG of blurred arcs for the top lights and the bottom shadows
 *    (FeGaussianBlur, the Classic's proven path).
 *  - One SVG per direction key: five embossed dots under the export's own
 *    drop + two inner shadows chain (offset, blur, arithmetic composite,
 *    color matrix, blend — all natively implemented, the arithmetic
 *    composite operator included). Sigmas are rounded to
 *    integers (0.5 -> 1, 1.5 -> 2): the iOS filter picks its blur with an
 *    NSNumber pointer comparison that only holds for integers (see the
 *    Classic's scaling note); at the sizes the device is drawn the
 *    difference is sub-pixel.
 *
 * Sizing goes through the same paint-only transform as the other shells;
 * the canvas is the Figma node's own 657 wide, so every realistic width
 * shrinks it — the free direction.
 *
 * The screen is a near-square glass (505x518 on the canvas, rx 18); its
 * content is the OLED family's vocabulary re-laid for the square (see
 * ./scenes). Animation attaches like the Classic's screen half alone:
 * `screenContent` fills the glass, `animation` drives the screen power
 * pair. The keys are still: the design asks for no press on the Mini's
 * engraved membrane, so no press drive exists here and the family's
 * scenes' OK presses land nowhere.
 */

const DEVICE_W = 657;
const DEVICE_H = 1417;
const BODY_W = 651;

/** The glass, which is also the content canvas: scenes author against
 * its full box (no inset slot like the Classic's). */
export const SCREEN_GLASS_W = 505;
export const SCREEN_GLASS_H = 518;

type IMiniDeviceButtonKey = 'up' | 'down' | 'left' | 'right';

/**
 * Animation contract of the code-drawn Mini: the presence engine's one
 * screen opacity, nothing else — the keys do not move.
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

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  device: {
    width: DEVICE_W,
    height: DEVICE_H,
  },
  // Power tab: #CFD0CF pill with a white 50% top light (INNER_SHADOW 0 6
  // blur 3). It sits under the body, which covers all but its outer 5pt.
  power: {
    position: 'absolute',
    left: 624,
    top: 663,
    width: 32,
    height: 130,
    borderRadius: 9,
    backgroundColor: '#CFD0CF',
    boxShadow: 'inset 0 6px 3px rgba(255,255,255,0.5)',
  },
  body: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BODY_W,
    height: DEVICE_H,
    borderRadius: 64,
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
  },
  // The edge vignette (INNER_SHADOW black 10%, spread 45, blur 173 = 2 x
  // the export's sigma 86.55). Figma frame effects render above children,
  // so this overlay is the body's last child.
  bodyShade: {
    ...StyleSheet.absoluteFill,
    borderRadius: 64,
    boxShadow: 'inset 0 0 173px 45px rgba(0,0,0,0.1)',
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
  absFill: {
    ...StyleSheet.absoluteFill,
  },
});

// The top lights and bottom shadows: four blurred arcs of the body's own
// outline, verbatim from the export (paths, opacities, filter regions).
function BodyLights() {
  return (
    <Svg
      width={BODY_W}
      height={DEVICE_H}
      viewBox={`0 0 ${BODY_W} ${DEVICE_H}`}
      fill="none"
      style={StyleSheet.absoluteFill}
    >
      <G opacity={0.1} filter="url(#md-bshadow2)">
        <Path
          d="M651 1353C651 1388.35 622.346 1417 587 1417H64C28.6538 1417 7.12806e-07 1388.35 0 1353V1349C7.12806e-07 1384.35 28.6538 1413 64 1413H587C622.346 1413 651 1384.35 651 1349V1353Z"
          fill="#000"
        />
      </G>
      <G opacity={0.2} filter="url(#md-bshadow1)">
        <Path
          d="M651 1353C651 1388.35 622.346 1417 587 1417H64C28.6538 1417 7.12806e-07 1388.35 0 1353V1352C7.12806e-07 1387.35 28.6538 1416 64 1416H587C622.346 1416 651 1387.35 651 1352V1353Z"
          fill="#000"
        />
      </G>
      <G filter="url(#md-tlight1)">
        <Path
          d="M587 0C622.346 0 651 28.6538 651 64V67C651 31.6538 622.346 3 587 3H64C28.6538 3 0 31.6538 0 67V64C0 28.6538 28.6538 0 64 0H587Z"
          fill="#fff"
        />
      </G>
      <G opacity={0.5} filter="url(#md-tlight2)">
        <Path
          d="M587 0C622.346 0 651 28.6538 651 64V72C651 36.6538 622.346 8 587 8H64C28.6538 8 0 36.6538 0 72V64C0 28.6538 28.6538 0 64 0H587Z"
          fill="#fff"
        />
      </G>
      <Defs>
        <Filter
          id="md-bshadow2"
          x={-4}
          y={1345}
          width={659}
          height={76}
          filterUnits="userSpaceOnUse"
        >
          <FeGaussianBlur stdDeviation={2} />
        </Filter>
        <Filter
          id="md-bshadow1"
          x={-1}
          y={1351}
          width={653}
          height={67}
          filterUnits="userSpaceOnUse"
        >
          <FeGaussianBlur stdDeviation={1} />
        </Filter>
        <Filter
          id="md-tlight1"
          x={-2}
          y={-2}
          width={655}
          height={71}
          filterUnits="userSpaceOnUse"
        >
          <FeGaussianBlur stdDeviation={1} />
        </Filter>
        <Filter
          id="md-tlight2"
          x={-4}
          y={-4}
          width={659}
          height={80}
          filterUnits="userSpaceOnUse"
        >
          <FeGaussianBlur stdDeviation={2} />
        </Filter>
      </Defs>
    </Svg>
  );
}

const BODY_LIGHTS = <BodyLights />;

/* ------------------------- direction keys ------------------------- *
 * Each key is five embossed dots (r 4) in a chevron, engraved into the
 * body. The boxes are the export's filter regions grown by 2 on every
 * side (the rounded-up drop-shadow blur bleeds a little further); dot
 * centres are the export's, in box-local coordinates. */

const KEY_ALPHA_MATRIX = '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0';
const KEY_SHADE_MATRIX = '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0';
const KEY_LIGHT_MATRIX = '0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.25 0';

interface IKeySpec {
  left: number;
  top: number;
  width: number;
  height: number;
  dots: Array<[number, number]>;
}

const KEYS: Record<IMiniDeviceButtonKey, IKeySpec> = {
  up: {
    left: 293,
    top: 816,
    width: 66,
    height: 44,
    dots: [
      [7, 36],
      [59, 36],
      [20, 22],
      [46, 22],
      [33, 8],
    ],
  },
  down: {
    left: 293,
    top: 1192,
    width: 66,
    height: 44,
    dots: [
      [7, 8],
      [59, 8],
      [20, 22],
      [46, 22],
      [33, 36],
    ],
  },
  left: {
    left: 126,
    top: 983,
    width: 42,
    height: 68,
    dots: [
      [35, 60],
      [35, 8],
      [21, 47],
      [21, 21],
      [7, 34],
    ],
  },
  right: {
    left: 485,
    top: 983,
    width: 42,
    height: 68,
    dots: [
      [7, 60],
      [7, 8],
      [21, 47],
      [21, 21],
      [35, 34],
    ],
  },
};

// The export's "dii" chain — drop shadow (0 1, black 25%), inner shadow
// (0 -2, black 25%: the shade under each dot's lower edge), inner shadow
// (0 2, white 25%: the light on its upper edge) — with integer sigmas.
function KeyDots({ id, spec }: { id: string; spec: IKeySpec }) {
  const filter = `url(#${id})`;
  return (
    <Svg
      width={spec.width}
      height={spec.height}
      viewBox={`0 0 ${spec.width} ${spec.height}`}
      fill="none"
    >
      <G filter={filter}>
        {spec.dots.map(([cx, cy]) => (
          <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={4} fill="#F5F5F5" />
        ))}
      </G>
      <Defs>
        <Filter
          id={id}
          x={0}
          y={0}
          width={spec.width}
          height={spec.height}
          filterUnits="userSpaceOnUse"
        >
          <FeFlood floodOpacity={0} result="bg" />
          <FeColorMatrix
            in="SourceAlpha"
            type="matrix"
            values={KEY_ALPHA_MATRIX}
            result="hardAlpha"
          />
          <FeOffset dy={1} />
          <FeGaussianBlur stdDeviation={1} />
          <FeComposite in2="hardAlpha" operator="out" />
          <FeColorMatrix type="matrix" values={KEY_SHADE_MATRIX} />
          <FeBlend mode="normal" in2="bg" result="drop" />
          <FeBlend mode="normal" in="SourceGraphic" in2="drop" result="shape" />
          <FeColorMatrix
            in="SourceAlpha"
            type="matrix"
            values={KEY_ALPHA_MATRIX}
            result="hardAlpha"
          />
          <FeOffset dy={-2} />
          <FeGaussianBlur stdDeviation={2} />
          <FeComposite in2="hardAlpha" operator="arithmetic" k2={-1} k3={1} />
          <FeColorMatrix type="matrix" values={KEY_SHADE_MATRIX} />
          <FeBlend mode="normal" in2="shape" result="shade" />
          <FeColorMatrix
            in="SourceAlpha"
            type="matrix"
            values={KEY_ALPHA_MATRIX}
            result="hardAlpha"
          />
          <FeOffset dy={2} />
          <FeGaussianBlur stdDeviation={2} />
          <FeComposite in2="hardAlpha" operator="arithmetic" k2={-1} k3={1} />
          <FeColorMatrix type="matrix" values={KEY_LIGHT_MATRIX} />
          <FeBlend mode="normal" in2="shade" />
        </Filter>
      </Defs>
    </Svg>
  );
}

function keyBox({ left, top, width, height }: IKeySpec): ViewStyle {
  return { position: 'absolute', left, top, width, height };
}

// Built once, like the Classic's chrome: react-native-svg re-runs
// transform/viewBox extraction on every render, and the keys take no
// props and never move.
const DEVICE_KEYS = (Object.keys(KEYS) as IMiniDeviceButtonKey[]).map(
  (name) => (
    <View key={name} pointerEvents="none" style={keyBox(KEYS[name])}>
      <KeyDots id={`md-key-${name}`} spec={KEYS[name]} />
    </View>
  ),
);

// Memoized like the Classic's body: the shell is a few dozen
// react-native-svg elements, and rn-svg re-runs prop extraction in
// render(), so it must only re-render when the scene actually changes.
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
      <View style={styles.power} />
      <View style={styles.body}>
        <View style={styles.screen}>
          <Animated.View pointerEvents="none" style={glowLayerStyle} />
          {screenContent ? (
            <Animated.View pointerEvents="none" style={slotLayerStyle}>
              {screenContent}
            </Animated.View>
          ) : null}
        </View>
        {DEVICE_KEYS}
        {BODY_LIGHTS}
        <View pointerEvents="none" style={styles.bodyShade} />
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
