import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSwitchVer = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m18 17.586 3-3L22.414 16 17 21.414 11.586 16 13 14.586l3 3V3h2zM12.414 8 11 9.414l-3-3V21H6V6.414l-3 3L1.586 8 7 2.586z" />
  </Svg>
);
export default SvgSwitchVer;
