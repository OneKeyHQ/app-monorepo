import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendarAdd = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.5 14a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2h-2a1 1 0 1 1 0-2h2v-2a1 1 0 0 1 1-1" />
    <Path d="M15.5 2a1 1 0 0 1 1 1v1h2a2 2 0 0 1 2 2v5a1 1 0 1 1-2 0v-1h-14v9h6a1 1 0 1 1 0 2h-6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V3a1 1 0 0 1 2 0v1h6V3a1 1 0 0 1 1-1" />
  </Svg>
);
export default SvgCalendarAdd;
