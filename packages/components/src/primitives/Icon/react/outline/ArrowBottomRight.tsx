import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowBottomRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 15.586V8h2v11H8v-2h7.586L4.836 6.25 6.25 4.836z" />
  </Svg>
);
export default SvgArrowBottomRight;
