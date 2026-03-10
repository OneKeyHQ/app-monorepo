import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.707 4.707 8.414 12l7.293 7.293-1.414 1.414L5.586 12l8.707-8.707z" />
  </Svg>
);
export default SvgChevronLeft;
