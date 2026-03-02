import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCornerDownLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21.414 4v12H6.828l3 3-1.414 1.414L3 15l5.414-5.414L9.828 11l-3 3h12.586V4z" />
  </Svg>
);
export default SvgCornerDownLeft;
