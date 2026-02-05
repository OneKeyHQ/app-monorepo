import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendarCheckDone = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20.219 15.375a1 1 0 0 1 1.562 1.25l-4 5a1 1 0 0 1-1.488.082l-2-2a1 1 0 1 1 1.414-1.414l1.209 1.21zM19 7a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v1h14zm2 5a1 1 0 1 1-2 0v-2H5v8a1 1 0 0 0 1 1h5a1 1 0 1 1 0 2H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 1 1 2 0v1h6V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3z" />
  </Svg>
);
export default SvgCalendarCheckDone;
