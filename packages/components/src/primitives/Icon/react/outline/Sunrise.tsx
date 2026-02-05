import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSunrise = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 19a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2zm4-4a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2zM4 11a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2zm11 1a3 3 0 1 0-6 0 1 1 0 1 1-2 0 5 5 0 0 1 10 0 1 1 0 1 1-2 0m6-1a1 1 0 1 1 0 2h-1a1 1 0 1 1 0-2zM4.93 4.929a1 1 0 0 1 1.414 0l.707.707A1 1 0 0 1 5.637 7.05l-.707-.707a1 1 0 0 1 0-1.414m12.726 0a1 1 0 0 1 1.414 1.414l-.707.707a1 1 0 1 1-1.414-1.414zM11 4V3a1 1 0 1 1 2 0v1a1 1 0 1 1-2 0" />
  </Svg>
);
export default SvgSunrise;
