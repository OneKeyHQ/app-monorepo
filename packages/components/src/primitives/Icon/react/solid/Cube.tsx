import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCube = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 12.577v10l-8.66-5v-10zm10.66 5-8.66 5v-10l8.66-5zm-1-11.732-8.66 5-8.66-5 8.66-5z" />
  </Svg>
);
export default SvgCube;
