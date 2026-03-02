import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronDoubleLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m12.586 8 4 4-4 4L14 17.414 19.414 12 14 6.586zm-7 0 4 4-4 4L7 17.414 12.414 12 7 6.586z" />
  </Svg>
);
export default SvgChevronDoubleLeft;
