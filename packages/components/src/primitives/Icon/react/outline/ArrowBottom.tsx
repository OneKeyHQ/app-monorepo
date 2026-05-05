import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowBottom = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m13 17.586 5-5L19.414 14 12 21.414 4.586 14 6 12.586l5 5V3h2z" />
  </Svg>
);
export default SvgArrowBottom;
