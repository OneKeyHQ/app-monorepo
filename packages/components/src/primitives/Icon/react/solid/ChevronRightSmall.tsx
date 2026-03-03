import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronRightSmall = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.414 12 10 17.414 8.586 16l4-4-4-4L10 6.586z" />
  </Svg>
);
export default SvgChevronRightSmall;
