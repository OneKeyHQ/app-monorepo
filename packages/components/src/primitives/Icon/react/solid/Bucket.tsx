import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBucket = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m20.386 9-1.503 12H5.117L3.614 9zM22 3v4H2V3z" />
  </Svg>
);
export default SvgBucket;
