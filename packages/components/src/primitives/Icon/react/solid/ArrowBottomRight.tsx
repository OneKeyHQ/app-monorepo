import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowBottomRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 13.879v-5.88h3v11H8v-3h5.879l-9.5-9.5L6.5 4.38z" />
  </Svg>
);
export default SvgArrowBottomRight;
