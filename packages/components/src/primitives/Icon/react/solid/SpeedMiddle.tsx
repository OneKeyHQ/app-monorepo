import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSpeedMiddle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10a10 10 0 0 1-.458 3H13V9a1 1 0 1 0-2 0v6H2.458A10 10 0 0 1 2 12m1.338 5A10 10 0 0 0 12 22a10 10 0 0 0 8.662-5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSpeedMiddle;
