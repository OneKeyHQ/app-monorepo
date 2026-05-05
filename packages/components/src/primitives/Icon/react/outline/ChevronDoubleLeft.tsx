import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronDoubleLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m11.414 8-4 4 4 4L10 17.414 4.586 12 10 6.586zm7 0-4 4 4 4L17 17.414 11.586 12 17 6.586z" />
  </Svg>
);
export default SvgChevronDoubleLeft;
