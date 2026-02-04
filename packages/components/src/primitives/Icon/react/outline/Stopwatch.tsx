import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgStopwatch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 13a7 7 0 1 0-14 0 7 7 0 0 0 14 0M8.293 9.293a1 1 0 0 1 1.414 0l3 3a1 1 0 1 1-1.414 1.414l-3-3a1 1 0 0 1 0-1.414M14 1a1 1 0 1 1 0 2h-4a1 1 0 0 1 0-2zm7 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" />
  </Svg>
);
export default SvgStopwatch;
