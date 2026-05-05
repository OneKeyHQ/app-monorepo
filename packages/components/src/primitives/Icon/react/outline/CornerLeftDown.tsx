import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCornerLeftDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m16 17.586 3-3L20.414 16 15 21.414 9.586 16 11 14.586l3 3V5H4V3h12z" />
  </Svg>
);
export default SvgCornerLeftDown;
