import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLightBulb = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 20v2H8v-2zm0-1H8v-3h8zM12 1a8 8 0 0 1 6.245 13H5.755A8 8 0 0 1 12 1" />
  </Svg>
);
export default SvgLightBulb;
