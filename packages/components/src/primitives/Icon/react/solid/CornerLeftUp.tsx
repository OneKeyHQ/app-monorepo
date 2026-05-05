import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCornerLeftUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m14.828 8.414-1.414 1.414-3-3v12.586h10v2h-12V6.828l-3 3L4 8.414 9.414 3z" />
  </Svg>
);
export default SvgCornerLeftUp;
