import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayoutSidebar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 21H3V3h6zm12 0H11v-8h10zm0-18v8H11V3z" />
  </Svg>
);
export default SvgLayoutSidebar;
