import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBlockPencilDark = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path
      stroke="#fff"
      strokeLinejoin="round"
      d="M65.658 56H135.5l-19 19-70 .158zM65.5 126h70l-19 19h-70z"
    />
    <Path stroke="#fff" strokeLinejoin="round" d="M65.5 56h70v70h-70z" />
    <Path stroke="#fff" strokeLinejoin="round" d="M46.5 75h70v70h-70z" />
    <Path fill="#fff" d="M116.498 145v-19H135.5z" opacity={0.8} />
    <Path fill="#4FE737" stroke="#000" d="M66.5 54.5V76H45z" />
    <Path
      fill="#000"
      stroke="#fff"
      d="m156 39 9.526 5.5-33 57.158a1 1 0 0 1-1.366.366l-7.794-4.5a1 1 0 0 1-.366-1.366z"
    />
    <Path fill="#000" stroke="#fff" d="m123 96.157 9.526 5.5-10.263 6.777z" />
  </Svg>
);
export default SvgBlockPencilDark;
