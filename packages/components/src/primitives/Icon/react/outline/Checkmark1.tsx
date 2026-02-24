import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckmark1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20.382 4.7 10.089 20.711l-6.494-8.118 1.561-1.25 4.755 5.944L18.7 3.618z" />
  </Svg>
);
export default SvgCheckmark1;
