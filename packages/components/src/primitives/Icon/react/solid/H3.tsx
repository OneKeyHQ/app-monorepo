import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgH3 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 11h8V4h2v16h-2v-7H4v7H2V4h2zm16-1a3 3 0 0 1 2.236 5A3 3 0 1 1 17 17h2a1 1 0 1 0 1-1h-1v-2h1a1 1 0 1 0-1-1h-2a3 3 0 0 1 3-3" />
  </Svg>
);
export default SvgH3;
