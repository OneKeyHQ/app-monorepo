import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPuzzle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9.5 4v-.5a2.5 2.5 0 0 1 5 0V4H21v5.5h-.5a2.5 2.5 0 0 0 0 5h.5V20H3V4z" />
  </Svg>
);
export default SvgPuzzle;
