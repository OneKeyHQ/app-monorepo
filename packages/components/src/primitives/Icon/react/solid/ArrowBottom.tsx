import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowBottom = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.5 3v12.879l4-4L19.621 14 12 21.621 4.379 14 6.5 11.879l4 4V3z" />
  </Svg>
);
export default SvgArrowBottom;
