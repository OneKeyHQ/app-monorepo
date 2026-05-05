import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTopRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 16h-3v-5.879l-9.5 9.5L4.379 17.5l9.5-9.5H8V5h11z" />
  </Svg>
);
export default SvgArrowTopRight;
