import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronTop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m20.707 14.293-1.414 1.414L12 8.414l-7.293 7.293-1.414-1.414L12 5.586z" />
  </Svg>
);
export default SvgChevronTop;
