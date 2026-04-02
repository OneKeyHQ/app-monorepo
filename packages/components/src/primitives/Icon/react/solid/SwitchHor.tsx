import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSwitchHor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m9.414 13-3 3H21v2H6.414l3 3L8 22.414 2.586 17 8 11.586zm12-6L16 12.414 14.586 11l3-3H3V6h14.586l-3-3L16 1.586z" />
  </Svg>
);
export default SvgSwitchHor;
