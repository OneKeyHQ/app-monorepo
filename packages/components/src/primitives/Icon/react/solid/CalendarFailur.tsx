import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendarFailur = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 2.5a1 1 0 0 1 1 1v1h2a2 2 0 0 1 2 2v5a1 1 0 1 1-2 0v-1H5v9h6a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h2v-1a1 1 0 0 1 2 0v1h6v-1a1 1 0 0 1 1-1" />
    <Path d="M19.293 15.793a1 1 0 1 1 1.414 1.414L19.414 18.5l1.293 1.293a1 1 0 1 1-1.414 1.414L18 19.914l-1.293 1.293a1 1 0 1 1-1.414-1.414l1.293-1.293-1.293-1.293a1 1 0 1 1 1.414-1.414L18 17.086z" />
  </Svg>
);
export default SvgCalendarFailur;
