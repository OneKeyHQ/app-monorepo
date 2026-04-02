import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTable = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 21H3V11h6zm12-10v10H11V11zM9 9H3V3h6zm12 0H11V3h10z" />
  </Svg>
);
export default SvgTable;
