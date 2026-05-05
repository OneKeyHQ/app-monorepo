import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLogout = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 5H5v14h7v2H3V3h9z" />
    <Path d="M21.414 12 15.5 17.914 14.086 16.5l3.5-3.5H8v-2h9.586l-3.5-3.5L15.5 6.086z" />
  </Svg>
);
export default SvgLogout;
