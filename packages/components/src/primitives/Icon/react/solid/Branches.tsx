import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBranches = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.5 3a3 3 0 0 1 1 5.83V13h-11v2.17a3.001 3.001 0 1 1-2 0V8.83a3.001 3.001 0 1 1 2 0V11h9V8.83a3.001 3.001 0 0 1 1-5.83" />
  </Svg>
);
export default SvgBranches;
