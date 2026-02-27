import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSwapHor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 16H6.914l2.293 2.293-1.414 1.414L2.086 14H21zm.914-6H3V8h14.086l-2.293-2.293 1.414-1.414z" />
  </Svg>
);
export default SvgSwapHor;
