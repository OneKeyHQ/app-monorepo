import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOption1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16.58 18H21v2h-5.58l-8-14H3V4h5.58zM21 6h-6V4h6z" />
  </Svg>
);
export default SvgOption1;
