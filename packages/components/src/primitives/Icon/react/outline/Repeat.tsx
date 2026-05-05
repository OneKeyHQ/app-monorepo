import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRepeat = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 19H6.414l2 2L7 22.414 2.586 18 7 13.586 8.414 15l-2 2H19v-5h2zm.414-13L17 10.414 15.586 9l2-2H5v5H3V5h14.586l-2-2L17 1.586z" />
  </Svg>
);
export default SvgRepeat;
