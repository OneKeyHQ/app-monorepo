import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTopLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 7H8.414l10.75 10.75-1.414 1.414L7 8.414V16H5V5h11z" />
  </Svg>
);
export default SvgArrowTopLeft;
