import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronDoubleDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.266 12.733a.992.992 0 0 1 1.403 1.403l-3.442 3.441a1.735 1.735 0 0 1-2.454 0l-3.442-3.441a.992.992 0 0 1 1.403-1.403L12 16zm0-6.943a.992.992 0 0 1 1.403 1.403l-3.442 3.442a1.736 1.736 0 0 1-2.454 0L7.331 7.193A.993.993 0 0 1 8.734 5.79L12 9.057z" />
  </Svg>
);
export default SvgChevronDoubleDown;
