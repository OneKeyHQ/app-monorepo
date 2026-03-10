import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19.621 10 17.5 12.12l-4-4V21h-3V8.12l-4 4L4.379 10 12 2.379l7.621 7.62Z" />
  </Svg>
);
export default SvgArrowTop;
