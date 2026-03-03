import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21.621 12 14 19.62l-2.121-2.12 4-4H3v-3h12.879l-4-4L14 4.379l7.621 7.62Z" />
  </Svg>
);
export default SvgArrowRight;
