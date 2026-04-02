import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronLargeDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22.36 10.389 12 16.144 1.64 10.389l.971-1.748L12 13.855l9.389-5.214.97 1.748Z" />
  </Svg>
);
export default SvgChevronLargeDown;
