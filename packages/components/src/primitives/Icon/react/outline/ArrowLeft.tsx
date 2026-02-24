import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m11.414 6-5 5H21v2H6.414l5 5L10 19.414 2.586 12 10 4.586z" />
  </Svg>
);
export default SvgArrowLeft;
