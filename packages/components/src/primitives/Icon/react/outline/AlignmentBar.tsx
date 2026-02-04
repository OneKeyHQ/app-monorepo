import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAlignmentBar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 19V5a1 1 0 0 1 2 0v14a1 1 0 1 1-2 0m14-2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2zm5-6a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2zm0-6a1 1 0 1 1 0 2H9a1 1 0 0 1 0-2z" />
  </Svg>
);
export default SvgAlignmentBar;
