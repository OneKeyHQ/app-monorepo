import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronDoubleUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10.773 10.635a1.735 1.735 0 0 0 2.454 0l3.442-3.442a.992.992 0 0 0-1.403-1.402L12 9.056 8.734 5.791a.993.993 0 0 0-1.403 1.402zm0 6.942a1.735 1.735 0 0 0 2.454 0l3.442-3.441a.992.992 0 0 0-1.403-1.403L12 16l-3.266-3.267a.993.993 0 0 0-1.403 1.403z" />
  </Svg>
);
export default SvgChevronDoubleUp;
