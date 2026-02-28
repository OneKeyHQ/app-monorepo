import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTopLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 5v3h-5.879l9.5 9.5-2.121 2.121-9.5-9.5V16H5V5z" />
  </Svg>
);
export default SvgArrowTopLeft;
