import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19.414 10 18 11.414l-5-5V21h-2V6.414l-5 5L4.586 10 12 2.586z" />
  </Svg>
);
export default SvgArrowTop;
