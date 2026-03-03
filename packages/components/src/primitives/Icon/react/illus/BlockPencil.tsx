import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBlockPencil = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path
      stroke="#000"
      strokeLinejoin="round"
      d="M65.158 56H135l-19 19-70 .158zM65 126h70l-19 19H46z"
    />
    <Path stroke="#000" strokeLinejoin="round" d="M65 56h70v70H65z" />
    <Path stroke="#000" strokeLinejoin="round" d="M46 75h70v70H46z" />
    <Path fill="#000" d="M115.998 145v-19H135z" />
    <Path
      fill="#4FE737"
      stroke="#000"
      strokeLinejoin="round"
      d="M65 56v19H46z"
    />
    <Path
      fill="#fff"
      stroke="#000"
      d="m156 39 9.526 5.5-33 57.158a1 1 0 0 1-1.366.366l-7.794-4.5a1 1 0 0 1-.366-1.366z"
    />
    <Path fill="#fff" stroke="#000" d="m123 96.157 9.526 5.5-10.263 6.777z" />
  </Svg>
);
export default SvgBlockPencil;
