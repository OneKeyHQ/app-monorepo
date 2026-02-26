import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m18.414 12-8.707 8.707-1.414-1.414L15.586 12 8.293 4.707l1.414-1.414z" />
  </Svg>
);
export default SvgChevronRight;
