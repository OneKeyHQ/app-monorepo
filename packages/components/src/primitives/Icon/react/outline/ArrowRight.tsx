import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.287 5.322a.995.995 0 0 1 1.408 0l5.974 5.974a.995.995 0 0 1 0 1.408l-5.974 5.974a.996.996 0 1 1-1.408-1.408l4.275-4.274H4.035a.996.996 0 1 1 0-1.992h13.527L13.287 6.73a.996.996 0 0 1 0-1.408" />
  </Svg>
);
export default SvgArrowRight;
