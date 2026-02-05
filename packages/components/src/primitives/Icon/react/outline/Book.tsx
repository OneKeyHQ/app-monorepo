import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBook = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 4a1 1 0 0 0-1 1v11.174A3 3 0 0 1 7 16h11V4zm5 6a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2zm3-4a1 1 0 1 1 0 2H9a1 1 0 0 1 0-2zM6 19a1 1 0 0 0 .897.995L7 20h11v-2H7a1 1 0 0 0-1 1m14 1a2 2 0 0 1-2 2H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3h11a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgBook;
