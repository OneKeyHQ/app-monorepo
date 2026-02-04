import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSunset = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 19a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2zm5-4a1 1 0 1 1 0 2H2a1 1 0 1 1 0-2zm-3-3a7 7 0 1 0-14 0 1 1 0 1 1-2 0 9 9 0 0 1 18 0 1 1 0 1 1-2 0" />
  </Svg>
);
export default SvgSunset;
