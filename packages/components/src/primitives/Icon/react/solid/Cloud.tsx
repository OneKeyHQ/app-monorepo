import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloud = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 4a7 7 0 0 1 6.941 6.089A5.001 5.001 0 0 1 18 20H7A6 6 0 0 1 5.599 8.165 7 7 0 0 1 12 4" />
  </Svg>
);
export default SvgCloud;
