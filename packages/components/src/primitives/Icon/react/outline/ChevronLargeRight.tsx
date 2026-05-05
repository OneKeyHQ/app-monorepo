import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronLargeRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m16.144 12-5.755 10.36-1.748-.971L13.855 12 8.641 2.611l1.748-.97z" />
  </Svg>
);
export default SvgChevronLargeRight;
