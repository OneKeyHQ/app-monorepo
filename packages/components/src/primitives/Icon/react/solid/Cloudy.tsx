import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloudy = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 4a8 8 0 0 1 6.979 4.087A6 6 0 1 1 17 20H9A8 8 0 1 1 9 4" />
  </Svg>
);
export default SvgCloudy;
