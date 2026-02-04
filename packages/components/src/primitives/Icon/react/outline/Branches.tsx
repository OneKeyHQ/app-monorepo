import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBranches = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 18.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0m0-13a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0m9 0a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0m2 0a3.5 3.5 0 0 1-2.5 3.354V11a2 2 0 0 1-2 2h-7v2.146a3.501 3.501 0 1 1-2 0V8.854a3.5 3.5 0 1 1 2 0V11h7V8.854A3.5 3.5 0 1 1 20 5.5" />
  </Svg>
);
export default SvgBranches;
