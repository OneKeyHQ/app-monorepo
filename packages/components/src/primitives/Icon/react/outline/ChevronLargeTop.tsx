import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronLargeTop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m22.36 13.611-.971 1.748L12 10.144l-9.389 5.215-.97-1.748L12 7.856z" />
  </Svg>
);
export default SvgChevronLargeTop;
