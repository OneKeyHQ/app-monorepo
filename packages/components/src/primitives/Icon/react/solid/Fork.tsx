import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFork = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18 3a3 3 0 0 1 1 5.83V13h-6v2.17a3.001 3.001 0 1 1-2 0V13H5V8.83a3.001 3.001 0 1 1 2 0V11h10V8.83A3.001 3.001 0 0 1 18 3" />
  </Svg>
);
export default SvgFork;
