import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronDoubleUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8.734 11.267A.992.992 0 0 1 7.33 9.864l3.442-3.441a1.736 1.736 0 0 1 2.454 0l3.442 3.441a.992.992 0 1 1-1.403 1.402L12 8zm0 6.942a.992.992 0 1 1-1.403-1.402l3.442-3.441a1.735 1.735 0 0 1 2.454 0l3.442 3.44a.992.992 0 0 1-1.403 1.403L12 14.943z" />
  </Svg>
);
export default SvgChevronDoubleUp;
