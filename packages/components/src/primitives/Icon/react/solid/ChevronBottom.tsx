import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronBottom = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20.707 9.707 12 18.414 3.293 9.707l1.414-1.414L12 15.586l7.293-7.293z" />
  </Svg>
);
export default SvgChevronBottom;
