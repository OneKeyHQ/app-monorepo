import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRedo = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 5v2h9v7H5.414l3-3L7 9.586 1.586 15 7 20.414 8.414 19l-3-3H22V5z" />
  </Svg>
);
export default SvgRedo;
