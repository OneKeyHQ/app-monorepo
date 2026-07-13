import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgInfoSimple = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 18h2v2H9v-2h2v-6.5H9v-2h4zM12 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3" />
  </Svg>
);
export default SvgInfoSimple;
