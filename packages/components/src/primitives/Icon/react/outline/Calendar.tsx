import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 11H5v8h14zM5 6v3h14V6zm16 13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V3a1 1 0 0 1 2 0v1h6V3a1 1 0 1 1 2 0v1h2a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgCalendar;
