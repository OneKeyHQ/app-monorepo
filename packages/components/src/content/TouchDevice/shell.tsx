import type { ReactNode } from 'react';
import { memo, useMemo } from 'react';

import { StyleSheet, View } from 'react-native';
import Animated, {
  makeMutable,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Defs, FeGaussianBlur, Filter, G, Path, Svg } from 'react-native-svg';

import { PRO_SCREEN_H, PRO_SCREEN_W } from '../ProDevice/shell';

import type { IDeviceScreenAnimation } from '../deviceSceneHost';

/**
 * Code-drawn OneKey Touch device, 1:1 against Figma node 21588:44669
 * (1044x1751 on the canvas: a 1038-wide body plus the power tab on the
 * right edge). Not exported from the components barrel yet.
 *
 * Every value is transcribed from the node's SVG export (the MCP code
 * translation flattens the node to one bitmap). The node's x axis starts
 * 8 left of the body (the export pads for the body's side lights); the
 * SVG layers below keep the export's coordinates by viewing the body
 * through a viewBox that starts at x=8, so paths are verbatim.
 *
 * The drawing is concentric slabs, all opaque:
 *
 *  - Body: #2E2E2E, r76, lit along both long edges (two INNER_SHADOWs,
 *    white 25%, offset +-10, blur 30) — an inset boxShadow pair; plain RN
 *    View + StyleSheet rather than Tamagui Stack is forced, since
 *    @tamagui/web lists `boxShadow` in webPropsToSkip.native.
 *  - Plate (#0C0C0C, inset 56, r21), ring (#252525, inset 57.5, r19.5)
 *    and the glass face (#151515, inset 63, r14.5): the bezel, as three
 *    nested rounded rects — a 1.5pt dark rim, a 5.5pt lighter ring, then
 *    the face.
 *  - The wordmark on the face's chin, below the screen; and the grounding
 *    shadow over the bottom chin (black 20%, layer blur sigma 4).
 *  - Power tab: black pill under the body's right edge, lit at both ends
 *    (white 50% inner shadows) with a dark seam — the Pro's recipe at
 *    twice the light.
 *
 * The screen is NOT the face. The design's Screen frame is an 801x1334
 * window inside the 913x1573 face — 57 of face above it, 56 either side,
 * 181 below where the wordmark sits — and it has no fill of its own: off,
 * the window is indistinguishable from the face around it. Content is
 * the Pro's (../ProDevice/scenes — the Touch runs the same screens), laid
 * out on the Pro's 288x484 canvas and paint-scaled into the window by
 * height (the two aspects differ by under 1%; the 3.6pt of face left
 * either side is below anything the device is drawn at). The scenes
 * composite over the face color, so the one scene that repaints the bare
 * panel — the passphrase grille — is built for this face (see
 * TOUCH_FACE and ../ProDevice/scenes createScenes).
 *
 * Sizing goes through the same paint-only transform as the other shells;
 * the canvas is the Figma node's own 1044 wide, so every realistic width
 * shrinks it — the free direction. The two blurs are integer sigmas (the
 * iOS filter caveat, see ../ClassicDevice).
 */

const DEVICE_W = 1044;
const DEVICE_H = 1751;
const BODY_W = 1038;

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
 * Animation contract of the code-drawn Touch: the presence engine's one
 * screen opacity — the Pro's contract, the Touch has no face keys either.
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

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  device: {
    width: DEVICE_W,
    height: DEVICE_H,
  },
  power: {
    position: 'absolute',
    left: 1014,
    top: 249,
    width: 30,
    height: 211,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: '#000',
    boxShadow:
      'inset 0 2px 2px rgba(255,255,255,0.5),' +
      ' inset 0 -2px 2px rgba(255,255,255,0.5),' +
      ' inset 1px 0 0 rgba(0,0,0,0.25)',
  },
  body: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BODY_W,
    height: DEVICE_H,
    borderRadius: 76,
    backgroundColor: '#2E2E2E',
    overflow: 'hidden',
    boxShadow:
      'inset 10px 0 30px rgba(255,255,255,0.25),' +
      ' inset -10px 0 30px rgba(255,255,255,0.25)',
  },
  plate: {
    position: 'absolute',
    left: 56,
    top: 56,
    width: 926,
    height: 1586,
    borderRadius: 21,
    backgroundColor: '#0C0C0C',
  },
  ring: {
    position: 'absolute',
    left: 57.5,
    top: 57.5,
    width: 923,
    height: 1583,
    borderRadius: 19.5,
    backgroundColor: '#252525',
  },
  face: {
    position: 'absolute',
    left: 63,
    top: 62.5,
    width: 913,
    height: 1573,
    borderRadius: 14.5,
    backgroundColor: TOUCH_FACE,
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

// The wordmark and the chin shadow, verbatim from the export (its
// coordinates, via the viewBox offset).
function FaceMarks() {
  return (
    <Svg
      width={BODY_W}
      height={DEVICE_H}
      viewBox={`8 0 ${BODY_W} ${DEVICE_H}`}
      fill="none"
      style={StyleSheet.absoluteFill}
    >
      <G fill="#fff">
        <Path d="M426.671 1563.97C422.169 1563.97 418.034 1562.91 414.267 1560.78C410.499 1558.65 407.513 1555.72 405.308 1551.97C403.103 1548.18 402 1543.9 402 1539.13C402 1534.41 403.103 1530.18 405.308 1526.43C407.513 1522.64 410.499 1519.68 414.267 1517.55C418.034 1515.42 422.169 1514.36 426.671 1514.36C431.219 1514.36 435.354 1515.42 439.075 1517.55C442.843 1519.68 445.806 1522.64 447.965 1526.43C450.17 1530.18 451.273 1534.41 451.273 1539.13C451.273 1543.9 450.17 1548.18 447.965 1551.97C445.806 1555.72 442.843 1558.65 439.075 1560.78C435.308 1562.91 431.173 1563.97 426.671 1563.97ZM426.671 1555.3C429.565 1555.3 432.115 1554.65 434.32 1553.36C436.526 1552.02 438.248 1550.12 439.489 1547.67C440.729 1545.22 441.349 1542.37 441.349 1539.13C441.349 1535.89 440.729 1533.07 439.489 1530.67C438.248 1528.22 436.526 1526.34 434.32 1525.05C432.115 1523.75 429.565 1523.1 426.671 1523.1C423.777 1523.1 421.204 1523.75 418.953 1525.05C416.747 1526.34 415.025 1528.22 413.784 1530.67C412.544 1533.07 411.924 1535.89 411.924 1539.13C411.924 1542.37 412.544 1545.22 413.784 1547.67C415.025 1550.12 416.747 1552.02 418.953 1553.36C421.204 1554.65 423.777 1555.3 426.671 1555.3Z" />
        <Path d="M476.161 1524.49C480.71 1524.49 484.385 1525.95 487.188 1528.86C489.99 1531.73 491.391 1535.76 491.391 1540.94V1563.49H481.743V1542.26C481.743 1539.2 480.985 1536.87 479.469 1535.25C477.953 1533.58 475.886 1532.75 473.267 1532.75C470.602 1532.75 468.489 1533.58 466.927 1535.25C465.411 1536.87 464.653 1539.2 464.653 1542.26V1563.49H455.005V1525.05H464.653V1529.83C465.939 1528.17 467.57 1526.87 469.546 1525.95C471.567 1524.98 473.772 1524.49 476.161 1524.49Z" />
        <Path d="M533.3 1543.43C533.3 1544.82 533.208 1546.07 533.024 1547.18H505.114C505.344 1549.96 506.309 1552.13 508.008 1553.7C509.708 1555.28 511.799 1556.06 514.28 1556.06C517.863 1556.06 520.413 1554.51 521.929 1551.41H532.335C531.232 1555.12 529.119 1558.17 525.995 1560.57C522.871 1562.93 519.035 1564.11 514.486 1564.11C510.811 1564.11 507.503 1563.3 504.563 1561.68C501.668 1560.02 499.394 1557.68 497.74 1554.68C496.132 1551.67 495.328 1548.2 495.328 1544.27C495.328 1540.29 496.132 1536.8 497.74 1533.79C499.348 1530.78 501.6 1528.47 504.494 1526.85C507.388 1525.23 510.719 1524.42 514.486 1524.42C518.116 1524.42 521.355 1525.21 524.203 1526.78C527.097 1528.35 529.326 1530.6 530.888 1533.51C532.496 1536.38 533.3 1539.69 533.3 1543.43ZM523.307 1540.66C523.261 1538.16 522.365 1536.17 520.62 1534.69C518.874 1533.17 516.737 1532.4 514.211 1532.4C511.822 1532.4 509.8 1533.14 508.146 1534.62C506.538 1536.06 505.551 1538.07 505.183 1540.66H523.307Z" />
        <Path d="M565.426 1563.49L547.922 1541.91V1563.49H538.274V1515.05H547.922V1536.77L565.426 1515.05H577.072L557.225 1539.06L577.624 1563.49H565.426Z" />
        <Path d="M611.88 1543.43C611.88 1544.82 611.788 1546.07 611.604 1547.18H583.694C583.924 1549.96 584.889 1552.13 586.588 1553.7C588.288 1555.28 590.379 1556.06 592.86 1556.06C596.443 1556.06 598.993 1554.51 600.509 1551.41H610.915C609.812 1555.12 607.699 1558.17 604.575 1560.57C601.451 1562.93 597.615 1564.11 593.066 1564.11C589.391 1564.11 586.083 1563.3 583.143 1561.68C580.248 1560.02 577.974 1557.68 576.32 1554.68C574.712 1551.67 573.908 1548.2 573.908 1544.27C573.908 1540.29 574.712 1536.8 576.32 1533.79C577.928 1530.78 580.179 1528.47 583.074 1526.85C585.968 1525.23 589.299 1524.42 593.066 1524.42C596.696 1524.42 599.935 1525.21 602.783 1526.78C605.677 1528.35 607.906 1530.6 609.468 1533.51C611.076 1536.38 611.88 1539.69 611.88 1543.43ZM601.887 1540.66C601.841 1538.16 600.945 1536.17 599.2 1534.69C597.454 1533.17 595.317 1532.4 592.791 1532.4C590.402 1532.4 588.38 1533.14 586.726 1534.62C585.118 1536.06 584.131 1538.07 583.763 1540.66H601.887Z" />
        <Path d="M652 1525.05L628.363 1581.67H618.095L626.364 1562.52L611.066 1525.05H621.885L631.74 1551.9L641.732 1525.05H652Z" />
      </G>
      <G opacity={0.2} filter="url(#td-chin)">
        <Path
          d="M1046 1673.96V1675C1046 1716.97 1011.97 1751 970 1751H84C42.0264 1751 8 1716.97 8 1675V1672.72L63.5 1620.5C64.5 1630 70.5 1639 80.5 1642H968.5C974.833 1639.83 987.5 1632.5 987.5 1620.5L1046 1673.96Z"
          fill="#000"
        />
      </G>
      <Defs>
        <Filter
          id="td-chin"
          x={0}
          y={1612.5}
          width={1054}
          height={146.5}
          filterUnits="userSpaceOnUse"
        >
          <FeGaussianBlur stdDeviation={4} />
        </Filter>
      </Defs>
    </Svg>
  );
}

// Built once: the marks take no props, and react-native-svg re-runs
// transform/viewBox extraction on every render.
const FACE_MARKS = <FaceMarks />;

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
      <View style={styles.power} />
      <View style={styles.body}>
        <View style={styles.plate} />
        <View style={styles.ring} />
        <View style={styles.face} />
        <View style={styles.screen}>
          {screenContent ? (
            <Animated.View pointerEvents="none" style={contentStyle}>
              {screenContent}
            </Animated.View>
          ) : null}
        </View>
        {FACE_MARKS}
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
