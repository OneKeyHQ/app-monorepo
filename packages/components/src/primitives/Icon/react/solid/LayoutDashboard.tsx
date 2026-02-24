import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayoutDashboard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 21H3V11h8zm10 0h-8v-6h8zm0-18v10h-8V3zM11 9H3V3h8z" />
  </Svg>
);
export default SvgLayoutDashboard;
