import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendar2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h2a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h2V3a1 1 0 0 1 1-1M3 19v-8h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2" />
  </Svg>
);
export default SvgCalendar2;
