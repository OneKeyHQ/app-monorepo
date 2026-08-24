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

import { PRO2_DEVICE_SCREEN_OFF, PRO2_DEVICE_SCREEN_ON } from './animation';

import type { IPro2DeviceAnimation } from './animation';

/**
 * PoC: code-drawn Pro 2 device, 1:1 against Figma node 20496:27747 (the
 * fill revision of 20384:27728: the top and corner lights became painted
 * fills; every other layer is byte-identical between the two frames). Not
 * exported from the components barrel yet.
 *
 * The source frame is drawn at 1084x1714 Figma px; px() divides every
 * transcribed value by K = 1084/350 so the canvas is 350pt wide like the
 * sibling shells (height 553.4 follows the device's aspect ratio). Layer
 * inventory, bottom to top, all inside the clipping body (Main, r205, #000):
 *
 * - Screen: uniform 73px bezel, r132 (concentric with the body), pure #000 -
 *   invisible until lit. The spec carries no reflection film, no recess seam
 *   and no wordmark, so the face is nothing but glass over black.
 * - Front side light: r180 ring at inset 25, white 2px stroke, blur 7.6 -
 *   the seam where the glass face meets the metal frame.
 * - Middle light: r193 ring at inset 12, white 2px stroke, blur 10 - the
 *   soft glow along the middle of the metal band.
 * - Top light: hand-painted crescent fill across the top arc (4-6px thick,
 *   tapered irregular ends), white at 50%, blur 12 - the wide bloom where
 *   overhead light catches the frame.
 * - Corner light: four sliver-lens fills on the corner curves, tapering to
 *   zero-width tips, white at 50%, blur 1 - sharp specular glints.
 * - Decoration bar: four white-15% wedges spanning the 25px metal band right
 *   where each corner curve meets the straight side - the antenna breaks.
 *   Outer edge follows the body curve, inner edge the front-side-light line.
 *
 * The metal is therefore drawn exactly as the Figma file draws it: blurred
 * white strokes for the rings, blurred hand-painted fills for the top bloom
 * and corner glints (the fills bake in tapered ends and uneven thickness a
 * uniform stroke could not carry). Conversion rules follow the Classic
 * transcription (LAYER_BLUR radius R -> gaussian sigma R/2, divided by K),
 * and the wide sigmas are then forced to integer literals: react-native-svg
 * on iOS picks its CIFilter by NSNumber POINTER equality in its gaussian
 * blur element (`_stdDeviationX == _stdDeviationY`), which only
 * reliably holds for integers, and the fallback branch is CIMotionBlur - a
 * visible directional smear at ring-light sigmas. So 7.6 -> 1, 10 -> 2,
 * 12 -> 2. The corner light is the exception that keeps its exact
 * fractional sigma (blur 1 -> 0.16): rounding would drop the blur or
 * wash the glint out six-fold, and at a sub-pixel radius the degraded
 * branch is indistinguishable from the gaussian anyway - CIMotionBlur
 * still receives inputRadius = sigma x screenScale, about half a device
 * pixel. Blur halos spill toward the body edge and are clipped by the
 * body's rounded overflow, which is exactly the Main frame's clipsContent
 * in the file.
 *
 * The screen stays pure black at all times — "lighting up" is only the
 * content rendering in, so there is no separate glow layer. Screen content
 * targets the 288x484 canvas and is scaled uniformly into the
 * 301.5x506.2 screen (~1.047, with 0.3pt of vertical overrun clipped by
 * the screen).
 *
 * Plain RN View + StyleSheet rather than Tamagui Stack is forced, not
 * stylistic: @tamagui/web lists `boxShadow` in webPropsToSkip.native, so a
 * Stack would drop the power button's cap lights on iOS and Android. Sizing
 * reuses the Classic's paint-only transform; blurs rasterize at the 350pt
 * canvas, so enlarging past ~1.3x softens (every current call site renders
 * at 350 or below).
 */

/** Figma px of the source frame (body 1080 + the 4px power tab). */
const FIGMA_W = 1084;
const FIGMA_H = 1714;

const DEVICE_W = 350;

/** Figma px -> canvas points (K = 1084/350), rounded to 1/10000pt. */
function px(v: number): number {
  return Math.round(((v * DEVICE_W) / FIGMA_W) * 10_000) / 10_000;
}

const DEVICE_H = px(FIGMA_H);

/**
 * Screen content canvas. Content is laid out on this fixed grid and the slot
 * scales it into the physical screen cutout.
 */
export const PRO2_SCREEN_W = 288;
export const PRO2_SCREEN_H = 484;

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
    width: px(1080),
    height: px(1714),
    borderRadius: px(205),
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  lights: {
    ...StyleSheet.absoluteFill,
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
  // 288x484 content canvas centered in the cutout, uniformly scaled to its
  // width; the 0.3pt of vertical overrun is clipped by the screen.
  screenSlot: {
    position: 'absolute',
    left: (px(934) - PRO2_SCREEN_W) / 2,
    top: (px(1568) - PRO2_SCREEN_H) / 2,
    width: PRO2_SCREEN_W,
    height: PRO2_SCREEN_H,
    transform: [{ scale: px(934) / PRO2_SCREEN_W }],
  },
  // Side power button: #000 + white 20% = #333, outer corners r2, cap lights
  // at both ends (white 50%, offset/blur 2), 1px dark seam against the body.
  power: {
    position: 'absolute',
    left: px(1080),
    top: px(234),
    width: px(4),
    height: px(288),
    borderTopRightRadius: px(2),
    borderBottomRightRadius: px(2),
    backgroundColor: '#333333',
    boxShadow:
      `inset 0 ${px(2)}px ${px(2)}px rgba(255,255,255,0.5),` +
      ` inset 0 ${-px(2)}px ${px(2)}px rgba(255,255,255,0.5),` +
      ` inset ${px(1)}px 0 0 rgba(0,0,0,0.25)`,
  },
});

/**
 * Transcribes Figma vector path data into canvas units: each coordinate is
 * offset by the node's position inside Main, then divided by K. Only the
 * absolute M/L/C/Z commands present in the dump are handled, and all of
 * their arguments are x,y pairs, so tokens alternate axes.
 */
function tx(figmaPath: string, nodeX: number, nodeY: number): string {
  let axis = 0;
  return figmaPath
    .trim()
    .split(/[\s,]+/)
    .map((token) => {
      if (/^[A-Za-z]$/.test(token)) {
        axis = 0;
        return token;
      }
      const offset = axis % 2 === 0 ? nodeX : nodeY;
      axis += 1;
      return px(parseFloat(token) + offset).toFixed(2);
    })
    .join(' ');
}

// Path data from the raw node dump, trimmed to 3 decimals (<0.001pt after
// scaling). The rings (Front/Middle light) are plain rounded rects and are
// drawn as <Rect> instead.

// Top bloom band: hand-painted crescent along the top arc, 4-6px thick
// with tapered irregular ends.
const TOP_LIGHT_D = tx(
  'M 339.878 0.038 C 400.769 -0.204 477.632 0.797 514.338 0.714 C' +
    ' 551.044 0.631 600.344 0.42 652.379 0.66 C 704.414 0.899 768.65' +
    ' 0.294 826.089 0.721 C 837.674 0.807 850.226 0.899 863.191 0.992 C' +
    ' 915.937 -0.215 969.862 29.278 991.149 50.247 C 1018.114 76.429' +
    ' 1023.679 84.508 1040.006 116.72 C 1048.933 135.556 1056.113' +
    ' 163.878 1056.301 188.132 C 1056.312 200.321 1056.093 197.505' +
    ' 1055.449 185.343 C 1054.257 167.508 1051.096 153.12 1048.243' +
    ' 144.399 C 1042.167 127.107 1039.35 119.854 1028.524 99.492 C' +
    ' 1016.999 79.446 1008.572 72.053 999.479 62.291 C 989.006 54.556' +
    ' 994.423 46.03 932.133 17.609 C 905.516 7.605 882.223 5.195 863.191' +
    ' 5.252 C 836.062 5.397 816.812 5.469 801.555 5.538 C 775.453 5.656' +
    ' 720.951 5.102 678.413 5.302 C 635.874 5.502 549.394 5.319 514.533' +
    ' 5.646 C 479.673 5.973 479.601 5.259 451.431 4.86 C 423.259 4.461' +
    ' 401.081 6.224 366.744 5.975 C 332.407 5.726 327.264 4.791 287.94' +
    ' 5.002 C 249.653 5.206 211.345 4.605 193.191 4.928 C 192.702 4.937' +
    ' 192.229 4.948 191.77 4.961 C 174.511 5.978 172.407 4.346 148.285' +
    ' 9.729 C 124.449 16.073 110.601 22.226 91.922 33.043 C 71.446' +
    ' 41.751 25.61 91.93 18.57 115.897 C 8.586 137.942 2.244 165.084' +
    ' 1.112 181.682 C 0.674 186.87 0.491 190.906 0.373 194.052 C 0.325' +
    ' 195.382 0.252 195.999 0.178 196 C 0.086 195.999 -0.01 195.041' +
    ' 0.001 193.33 C 0.052 185.075 0.605 172.624 3.133 158.173 C 8.979' +
    ' 131.534 9.56 128.078 27.129 95.64 C 46.815 64.619 62.374 46.613' +
    ' 100.285 25.022 C 135.105 8.475 147.346 2.447 193.191 0.879 C' +
    ' 198.744 0.928 204.795 1.003 211.453 1.11 C 272.556 2.093 278.987' +
    ' 0.279 339.878 0.038 Z',
  11.808_75,
  9.000_43,
);

// Four corner glints: sliver lenses that taper to zero-width tips.
const CORNER_LIGHT_D = tx(
  'M 0.044 1497.201 C 0.06 1497.201 0.076 1497.338 0.08 1497.582 C' +
    ' 0.099 1498.769 0.15 1500.542 0.278 1502.628 C 0.54 1506.524 0.422' +
    ' 1506.951 0.885 1512.202 C 1.401 1517.443 1.856 1520.576 2.738' +
    ' 1526.704 C 3.704 1532.823 4.182 1534.181 6.042 1542.718 C 8.066' +
    ' 1551.223 8.624 1552.034 11.436 1560.263 C 14.277 1568.49 18.612' +
    ' 1578.602 21.016 1583.271 C 23.366 1587.963 26.763 1594.146 30.714' +
    ' 1600.451 C 34.642 1606.773 40.087 1614.188 45.293 1620.539 C' +
    ' 50.421 1626.961 58.503 1635.336 62.451 1638.977 C 66.371 1642.643' +
    ' 67.357 1643.511 71.369 1646.777 C 73.678 1648.642 76.9 1651.169' +
    ' 79.656 1653.263 C 81.045 1654.316 80.692 1654.132 79.257 1653.12 C' +
    ' 77.162 1651.636 75.514 1650.335 74.427 1649.573 C 72.265 1648.049' +
    ' 71.353 1647.391 68.844 1645.187 C 66.351 1642.975 65.06 1642.055' +
    ' 63.629 1640.738 C 62.236 1639.385 62.191 1639.471 55.161 1632.519' +
    ' C 48.218 1625.472 44.824 1621.215 42.451 1618.32 C 40.073 1615.421' +
    ' 35.451 1609.101 32.088 1604.004 C 28.607 1598.979 22.492 1588.161' +
    ' 20.294 1583.662 C 18.035 1579.194 18.154 1579.125 16.555 1575.412' +
    ' C 14.99 1571.688 13.494 1568.858 11.807 1564.22 C 10.162 1559.571' +
    ' 10.057 1558.827 8.336 1553.452 C 6.635 1548.07 5.383 1542.556' +
    ' 4.762 1540.124 C 4.144 1537.687 4.263 1537.389 3.517 1533.902 C' +
    ' 2.79 1530.408 2.453 1528.274 2.043 1525.181 C 1.577 1522.095 0.574' +
    ' 1512.573 0.327 1509.095 C 0.009 1505.627 0.004 1501.646 0.001' +
    ' 1499.26 C -0.002 1498.516 0.006 1497.929 0.016 1497.48 C 0.021' +
    ' 1497.291 0.032 1497.203 0.044 1497.201 Z M 1055.99 1498.137 C' +
    ' 1056.042 1496.688 1056.096 1497.016 1056.106 1498.476 C 1056.117' +
    ' 1500.61 1056.032 1502.359 1056.057 1503.461 C 1056.102 1505.662' +
    ' 1056.112 1506.6 1055.847 1509.364 C 1055.572 1512.126 1055.625' +
    ' 1513.444 1055.449 1515.053 C 1055.237 1516.658 1055.268 1516.636' +
    ' 1054.192 1524.792 C 1053.029 1532.939 1052.004 1537.345 1051.333' +
    ' 1540.388 C 1050.663 1543.434 1048.935 1549.713 1047.429 1554.565 C' +
    ' 1046.012 1559.447 1042.371 1569.119 1040.732 1572.948 C 1039.136' +
    ' 1576.795 1039.011 1576.752 1037.536 1579.774 C 1036.039 1582.784' +
    ' 1035.13 1585.291 1033.165 1588.896 C 1031.174 1592.484 1030.746' +
    ' 1592.948 1028.387 1597.007 C 1026.014 1601.06 1023.327 1604.918' +
    ' 1022.199 1606.677 C 1021.068 1608.436 1020.79 1608.513 1019.095' +
    ' 1610.947 C 1017.388 1613.375 1016.28 1614.794 1014.634 1616.801 C' +
    ' 1013.019 1618.833 1007.855 1624.9 1005.932 1627.069 C 1004.048' +
    ' 1629.273 1001.662 1631.569 1000.24 1632.955 C 999.797 1633.388' +
    ' 999.443 1633.723 999.169 1633.977 C 999.052 1634.084 998.991' +
    ' 1634.126 998.982 1634.117 C 998.973 1634.105 999.043 1634.015' +
    ' 999.184 1633.871 C 999.877 1633.168 1000.898 1632.105 1002.062' +
    ' 1630.811 C 1004.221 1628.385 1004.56 1628.217 1007.432 1624.906 C' +
    ' 1010.275 1621.572 1011.884 1619.488 1015.1 1615.464 C 1018.271' +
    ' 1611.4 1018.778 1610.306 1022.977 1604.372 C 1027.082 1598.367' +
    ' 1027.226 1597.546 1030.763 1591.234 C 1034.285 1584.909 1038.304' +
    ' 1576.689 1039.966 1572.649 C 1041.665 1568.626 1043.771 1563.149' +
    ' 1045.744 1557.281 C 1047.735 1551.418 1049.686 1544.022 1051.194' +
    ' 1537.359 C 1052.771 1530.707 1054.278 1521.148 1054.771 1516.706 C' +
    ' 1055.288 1512.269 1055.388 1511.18 1055.616 1506.885 C 1055.738' +
    ' 1504.416 1055.884 1501.014 1055.99 1498.137 Z M 868.858 0.049 C' +
    ' 870.905 -0.022 871.77 -0.043 874.344 0.179 C 876.909 0.41 878.137' +
    ' 0.331 879.633 0.476 C 881.124 0.651 881.105 0.638 888.695 1.506 C' +
    ' 896.279 2.45 900.393 3.314 903.23 3.877 C 906.075 4.441 911.936' +
    ' 5.923 916.475 7.212 C 921.04 8.421 930.108 11.573 933.707 12.991 C' +
    ' 937.323 14.372 937.28 14.495 940.125 15.789 C 942.957 17.101' +
    ' 945.32 17.857 948.722 19.579 C 952.112 21.324 952.549 21.717' +
    ' 956.393 23.775 C 960.233 25.848 963.903 28.214 965.579 29.194 C' +
    ' 967.255 30.177 967.326 30.444 969.652 31.924 C 971.97 33.414' +
    ' 973.331 34.388 975.256 35.837 C 977.204 37.26 983.055 41.789' +
    ' 985.165 43.462 C 987.301 45.103 989.543 47.207 990.901 48.455 C' +
    ' 991.325 48.843 991.653 49.156 991.902 49.398 C 992.007 49.5' +
    ' 992.049 49.554 992.041 49.564 C 992.03 49.575 991.942 49.516 991.8' +
    ' 49.392 C 991.112 48.787 990.072 47.896 988.81 46.884 C 986.45' +
    ' 45.008 986.28 44.697 983.074 42.19 C 979.848 39.707 977.841 38.312' +
    ' 973.979 35.485 C 970.084 32.699 969.037 32.29 963.387 28.592 C' +
    ' 957.679 24.978 956.902 24.889 950.933 21.802 C 944.953 18.728' +
    ' 937.22 15.205 933.426 13.765 C 929.649 12.292 924.512 10.472' +
    ' 919.021 8.77 C 913.533 7.05 906.624 5.401 900.409 4.12 C 894.201' +
    ' 2.778 885.305 1.523 881.171 1.118 C 877.047 0.692 876.036 0.611' +
    ' 872.041 0.446 C 869.75 0.359 866.588 0.251 863.914 0.165 C 862.565' +
    ' 0.123 862.871 0.067 864.228 0.047 C 866.213 0.021 867.83 0.087' +
    ' 868.858 0.049 Z M 183.848 0.18 C 186.528 -0.027 189.607 0.039' +
    ' 191.451 0.06 C 192.026 0.065 192.479 0.077 192.827 0.091 C 192.973' +
    ' 0.097 193.041 0.109 193.043 0.121 C 193.042 0.137 192.937 0.152' +
    ' 192.748 0.154 C 191.829 0.165 190.459 0.199 188.847 0.289 C' +
    ' 185.832 0.472 185.508 0.353 181.44 0.63 C 177.386 0.938 174.953' +
    ' 1.241 170.197 1.718 C 165.433 2.247 164.386 2.642 157.71 3.666 C' +
    ' 151.046 4.793 150.411 5.245 143.908 6.94 C 137.405 8.651 129.3' +
    ' 11.203 125.516 12.668 C 121.723 14.099 116.686 16.181 111.464' +
    ' 18.587 C 106.234 20.978 99.992 24.371 94.513 27.571 C 89 30.72' +
    ' 81.54 35.732 78.196 38.191 C 74.839 40.631 74.033 41.247 70.954' +
    ' 43.791 C 69.188 45.26 66.765 47.293 64.719 49.016 C 63.691 49.884' +
    ' 63.88 49.639 64.875 48.718 C 66.331 47.373 67.584 46.335 68.319' +
    ' 45.623 C 69.792 44.204 70.427 43.606 72.487 42.054 C 74.552 40.51' +
    ' 75.408 39.634 76.62 38.741 C 77.849 37.874 77.822 37.88 84.051' +
    ' 33.453 C 90.326 29.088 93.962 26.982 96.45 25.504 C 98.942 24.023' +
    ' 104.293 21.207 108.53 19.131 C 112.733 16.978 121.584 13.259' +
    ' 125.208 11.906 C 128.819 10.515 128.871 10.634 131.85 9.694 C' +
    ' 134.834 8.776 137.096 7.759 140.777 6.765 C 144.466 5.796 145.052' +
    ' 5.796 149.288 4.758 C 153.532 3.732 157.839 3.041 159.742 2.65 C' +
    ' 161.649 2.261 161.876 2.412 164.596 1.959 C 167.317 1.519 168.982' +
    ' 1.334 171.38 1.126 C 173.783 0.884 181.154 0.345 183.848 0.18 Z',
  11.957_47,
  11.880_76,
);

// Antenna breaks: four wedges across the 25px metal band, outer edge on the
// body curve, inner edge on the front-side-light line.
const DECORATION_BAR_D = tx(
  'M 1079.1875 1349 C 1078.8287 1354.7338 1078.2347 1360.4036 1077.4141 1366' +
    ' L 1052.1016 1366 C 1053.0384 1360.4162 1053.7179 1354.7456' +
    ' 1054.1279 1349 L 1079.1875 1349 Z' +
    ' M 25.0586 1349 C 25.4686 1354.7455 26.1482 1360.4162 27.085 1366' +
    ' L 1.7734 1366 C 0.9528 1360.4036 0.3588 1354.7338 0 1349' +
    ' L 25.0586 1349 Z' +
    ' M 1077.1094 0 C 1077.9864 5.5949 1078.638 11.2647 1079.0527 17' +
    ' L 1053.9746 17 C 1053.5004 11.2526 1052.7583 5.5816 1051.7568 0' +
    ' L 1077.1094 0 Z' +
    ' M 27.4307 0 C 26.4292 5.5816 25.6871 11.2526 25.2129 17' +
    ' L 0.1348 17 C 0.5495 11.2647 1.2011 5.5949 2.0781 0 L 27.4307 0 Z',
  0.406_25,
  173,
);

// The metal highlights, in the file's stacking order. Filter regions are
// userSpaceOnUse boxes padded past 3 sigma plus the stroke, so nothing
// clips before the body's rounded overflow does.
const METAL_LIGHTS = (
  <Svg
    width={px(1080)}
    height={px(1714)}
    viewBox={`0 0 ${px(1080)} ${px(1714)}`}
    fill="none"
    style={styles.lights}
    pointerEvents="none"
  >
    <G filter="url(#sd-light-front)">
      <Rect
        x={px(25)}
        y={px(25)}
        width={px(1030)}
        height={px(1664)}
        rx={px(180)}
        stroke="#fff"
        strokeWidth={px(2)}
        fill="none"
      />
    </G>
    <G filter="url(#sd-light-middle)">
      <Rect
        x={px(12)}
        y={px(12)}
        width={px(1056)}
        height={px(1690)}
        rx={px(193)}
        stroke="#fff"
        strokeWidth={px(2)}
        fill="none"
      />
    </G>
    <G opacity={0.5} filter="url(#sd-light-top)">
      <Path d={TOP_LIGHT_D} fill="#fff" />
    </G>
    <G filter="url(#sd-light-corner)">
      <Path d={CORNER_LIGHT_D} opacity={0.5} fill="#fff" />
    </G>
    <Path d={DECORATION_BAR_D} opacity={0.15} fill="#fff" />
    <Defs>
      <Filter
        id="sd-light-front"
        x={px(25) - 4}
        y={px(25) - 4}
        width={px(1030) + 8}
        height={px(1664) + 8}
        filterUnits="userSpaceOnUse"
      >
        <FeGaussianBlur stdDeviation={1} />
      </Filter>
      <Filter
        id="sd-light-middle"
        x={px(12) - 7}
        y={px(12) - 7}
        width={px(1056) + 14}
        height={px(1690) + 14}
        filterUnits="userSpaceOnUse"
      >
        <FeGaussianBlur stdDeviation={2} />
      </Filter>
      <Filter
        id="sd-light-top"
        x={px(11.808_75) - 8}
        y={px(9.000_43) - 8}
        width={px(1056.301) + 16}
        height={px(196) + 16}
        filterUnits="userSpaceOnUse"
      >
        <FeGaussianBlur stdDeviation={2} />
      </Filter>
      {/* The one fractional sigma: Figma blur 1 -> 0.16 after scaling, and
          rounding it to an integer would either drop the blur or wash the
          glints out six-fold. Safe at this size only - see the header note. */}
      <Filter
        id="sd-light-corner"
        x={px(11.957_47) - 2}
        y={px(11.880_76) - 2}
        width={px(1056.107) + 4}
        height={px(1653.971) + 4}
        filterUnits="userSpaceOnUse"
      >
        <FeGaussianBlur stdDeviation={px(1) / 2} />
      </Filter>
    </Defs>
  </Svg>
);

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
      <View style={styles.body}>
        <View style={styles.screen}>
          {screenContent ? (
            <Animated.View pointerEvents="none" style={slotLayerStyle}>
              {screenContent}
            </Animated.View>
          ) : null}
        </View>
        {METAL_LIGHTS}
      </View>
      <View style={styles.power} />
    </>
  );
});

export interface IPro2DeviceShellProps {
  /**
   * Rendered width in points. Height follows the fixed 1084:1714 aspect
   * ratio (553.4 at the default 350).
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
  // the inner view keeps the explicit 350x553 so transformOrigin resolves
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
