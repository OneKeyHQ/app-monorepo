import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayoutTop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 11v10H3V11zm0-2H3V3h18z" />
  </Svg>
);
export default SvgLayoutTop;
