import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronLargeTop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m22.36 13.612-.972 1.748L12 10.145 2.612 15.36l-.972-1.748L12 7.856z" />
  </Svg>
);
export default SvgChevronLargeTop;
