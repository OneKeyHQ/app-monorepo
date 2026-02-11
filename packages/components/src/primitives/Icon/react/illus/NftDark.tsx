import Svg, { Rect, Path, Mask, G } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNftDark = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Rect
      width={96}
      height={118}
      x={42}
      y={25}
      stroke="#fff"
      strokeLinejoin="round"
      rx={4}
      style={{
        stroke: '#fff',
        strokeOpacity: 1,
      }}
    />
    <Path
      stroke="#fff"
      d="M51.5 34.5h77v77h-77z"
      style={{
        stroke: '#fff',
        strokeOpacity: 1,
      }}
    />
    <Mask
      id="mask0_882_29591"
      width={76}
      height={76}
      x={52}
      y={35}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: 'alpha',
      }}
    >
      <Path
        fill="#D9D9D9"
        d="M52 35h76v76H52z"
        style={{
          fill: '#d9d9d9',
          fill: 'color(display-p3 .851 .851 .851)',
          fillOpacity: 1,
        }}
      />
    </Mask>
    <G mask="url(#mask0_882_29591)">
      <Path
        stroke="#fff"
        d="M51 77.824 63.839 65l47.598 47.904"
        style={{
          stroke: '#fff',
          strokeOpacity: 1,
        }}
      />
    </G>
    <Path
      fill="#fff"
      d="M120 66h-3V49h-17v-3h20z"
      style={{
        fill: '#fff',
        fillOpacity: 1,
      }}
    />
    <Path
      stroke="#fff"
      d="M97 49h20v20H97z"
      style={{
        stroke: '#fff',
        strokeOpacity: 1,
      }}
    />
    <Path
      fill="#32B826"
      stroke="#000"
      d="M51.5 123.5h28v4h-28z"
      style={{
        fill: '#32b826',
        fill: 'color(display-p3 .1961 .7216 .149)',
        fillOpacity: 1,
        stroke: '#000',
        strokeOpacity: 1,
      }}
    />
  </Svg>
);
export default SvgNftDark;
