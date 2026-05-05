import Svg, { Rect, Path, Mask, G } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Rect
      width={96}
      height={118}
      x={42}
      y={25}
      stroke="#000"
      strokeLinejoin="round"
      rx={4}
    />
    <Path stroke="#000" d="M51.5 34.5h77v77h-77z" />
    <Mask
      id="mask0_882_29093"
      width={76}
      height={76}
      x={52}
      y={35}
      maskUnits="userSpaceOnUse"
    >
      <Path fill="#D9D9D9" d="M52 35h76v76H52z" />
    </Mask>
    <G mask="url(#mask0_882_29093)">
      <Path stroke="#000" d="M51 77.824 63.839 65l47.598 47.904" />
    </G>
    <Path fill="#000" d="M120 66h-3V49h-17v-3h20z" />
    <Path stroke="#000" d="M97 49h20v20H97z" />
    <Path fill="#3EDC2F" stroke="#000" d="M51.5 123.5h28v4h-28z" />
  </Svg>
);
export default SvgNft;
