import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHomeRoof = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m22.895 9.57-1.165 1.626L20 9.958V21H4V9.958l-1.731 1.238L1.104 9.57 12 1.77z" />
  </Svg>
);
export default SvgHomeRoof;
