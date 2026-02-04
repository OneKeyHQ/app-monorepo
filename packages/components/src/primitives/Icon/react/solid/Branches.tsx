import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBranches = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.5 2a3.5 3.5 0 0 0-1 6.855v6.29A3.502 3.502 0 0 0 7.5 22a3.5 3.5 0 0 0 1-6.855V13h7a2 2 0 0 0 2-2V8.855A3.502 3.502 0 0 0 16.5 2a3.5 3.5 0 0 0-1 6.855V11h-7V8.855A3.502 3.502 0 0 0 7.5 2" />
  </Svg>
);
export default SvgBranches;
