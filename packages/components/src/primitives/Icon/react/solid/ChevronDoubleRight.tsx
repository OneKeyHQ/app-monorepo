import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronDoubleRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.414 12 7 17.414 5.586 16l4-4-4-4L7 6.586zm7 0L14 17.414 12.586 16l4-4-4-4L14 6.586z" />
  </Svg>
);
export default SvgChevronDoubleRight;
