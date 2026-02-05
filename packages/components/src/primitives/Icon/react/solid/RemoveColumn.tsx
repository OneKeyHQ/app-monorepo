import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRemoveColumn = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a1 1 0 0 0 1-1V6h7v4a1 1 0 1 0 2 0V6a2 2 0 0 0-2-2z" />
    <Path d="M17.707 14.293a1 1 0 0 0-1.414 1.414L17.586 17l-1.293 1.293a1 1 0 0 0 1.414 1.414L19 18.414l1.293 1.293a1 1 0 0 0 1.414-1.414L20.414 17l1.293-1.293a1 1 0 0 0-1.414-1.414L19 15.586z" />
  </Svg>
);
export default SvgRemoveColumn;
