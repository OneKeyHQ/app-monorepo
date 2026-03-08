import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronLargeDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22.36 10.389 12 16.145 1.64 10.389l.972-1.748 9.387 5.215 9.39-5.215z" />
  </Svg>
);
export default SvgChevronLargeDown;
