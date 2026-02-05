import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronDoubleDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.266 12.733a.992.992 0 1 1 1.403 1.403l-3.442 3.442a1.736 1.736 0 0 1-2.454 0L7.33 14.136a.992.992 0 1 1 1.403-1.402L12 16zm0-6.942a.992.992 0 1 1 1.403 1.402l-3.442 3.441a1.735 1.735 0 0 1-2.454 0L7.33 7.193a.992.992 0 1 1 1.403-1.402L12 9.057z" />
  </Svg>
);
export default SvgChevronDoubleDown;
