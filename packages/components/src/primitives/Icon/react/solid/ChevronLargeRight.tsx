import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronLargeRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m16.144 12-5.756 10.36-1.748-.971L13.856 12 8.64 2.612l1.748-.971z" />
  </Svg>
);
export default SvgChevronLargeRight;
