import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowPathDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4.445 9.626c-.86.974-.168 2.505 1.13 2.505H7.98v9.046c0 1.11.9 2.01 2.01 2.01h4.02c1.11 0 2.01-.9 2.01-2.01v-9.046h2.405c1.298 0 1.99-1.531 1.13-2.505l-6.048-6.854a2.01 2.01 0 0 0-3.014 0z" />
  </Svg>
);
export default SvgArrowPathDown;
