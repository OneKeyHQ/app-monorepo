import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCornerRightUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20.414 8 19 9.414l-3-3V21H4v-2h10V6.414l-3 3L9.586 8 15 2.586z" />
  </Svg>
);
export default SvgCornerRightUp;
