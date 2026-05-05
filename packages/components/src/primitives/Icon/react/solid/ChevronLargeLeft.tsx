import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronLargeLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.36 2.612 10.144 12l5.216 9.389-1.748.971L7.856 12l5.756-10.36z" />
  </Svg>
);
export default SvgChevronLargeLeft;
