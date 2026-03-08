import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronTopSmall = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.414 14 16 15.414l-4-4-4 4L6.586 14 12 8.586z" />
  </Svg>
);
export default SvgChevronTopSmall;
