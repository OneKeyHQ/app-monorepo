import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBatteryFull = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 14v-4a1 1 0 0 1 2 0v4a1 1 0 1 1-2 0m4.5 0v-4a1 1 0 1 1 2 0v4a1 1 0 1 1-2 0m4.5 0v-4a1 1 0 1 1 2 0v4a1 1 0 1 1-2 0m6 0h1v-4h-1zM3 7v10h15V7zm17 1h1.5A1.5 1.5 0 0 1 23 9.5v5a1.5 1.5 0 0 1-1.5 1.5H20v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgBatteryFull;
