import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAlignmentBar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 20H2V4h2zm13-1H8v-2h9zm5-6H8v-2h14zm0-6H8V5h14z" />
  </Svg>
);
export default SvgAlignmentBar;
