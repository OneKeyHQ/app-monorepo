import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCornerDownLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 16H6.414l3 3L8 20.414 2.586 15 8 9.586 9.414 11l-3 3H19V4h2z" />
  </Svg>
);
export default SvgCornerDownLeft;
