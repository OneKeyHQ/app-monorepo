import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCornerDownRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 14h12.586l-3-3L16 9.586 21.414 15 16 20.414 14.586 19l3-3H3V4h2z" />
  </Svg>
);
export default SvgCornerDownRight;
