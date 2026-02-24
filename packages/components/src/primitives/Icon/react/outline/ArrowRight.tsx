import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21.414 12 14 19.414 12.586 18l5-5H3v-2h14.586l-5-5L14 4.586z" />
  </Svg>
);
export default SvgArrowRight;
