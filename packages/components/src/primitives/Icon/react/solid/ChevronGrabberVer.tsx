import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronGrabberVer = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.414 15 12 20.414 6.586 15 8 13.586l4 4 4-4zm0-6L16 10.414l-4-4-4 4L6.586 9 12 3.586z" />
  </Svg>
);
export default SvgChevronGrabberVer;
