import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBucket = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m3.614 9 1.284 10.249A2 2 0 0 0 6.883 21h10.234a2 2 0 0 0 1.985-1.751L20.386 9zM3 3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1z" />
  </Svg>
);
export default SvgBucket;
