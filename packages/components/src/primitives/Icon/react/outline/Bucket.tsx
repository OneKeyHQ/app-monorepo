import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBucket = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 3a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-.614l-1.284 10.249A2 2 0 0 1 17.117 21H6.883a2 2 0 0 1-1.985-1.751L3.615 9H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM6.883 19h10.234L18.37 9H5.63zM4 7h.46l.037-.002h15.006l.036.002H20V5H4z" />
  </Svg>
);
export default SvgBucket;
