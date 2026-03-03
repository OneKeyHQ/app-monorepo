import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCornerRightUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20.414 8.414 19 9.828l-3-3v14.586H4v-2h10V6.828l-3 3-1.414-1.414L15 3z" />
  </Svg>
);
export default SvgCornerRightUp;
