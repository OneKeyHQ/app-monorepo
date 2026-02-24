import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCornerLeftUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.414 8 13 9.414l-3-3V19h10v2H8V6.414l-3 3L3.586 8 9 2.586z" />
  </Svg>
);
export default SvgCornerLeftUp;
