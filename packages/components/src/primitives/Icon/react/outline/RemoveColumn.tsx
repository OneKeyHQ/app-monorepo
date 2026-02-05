import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRemoveColumn = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 10V6h-7v13a1 1 0 0 1-1 1H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a1 1 0 1 1-2 0M4 18h7V6H4z" />
    <Path d="M20.293 14.293a1 1 0 1 1 1.414 1.414L20.414 17l1.293 1.293a1 1 0 1 1-1.414 1.414L19 18.414l-1.293 1.293a1 1 0 1 1-1.414-1.414L17.586 17l-1.293-1.293a1 1 0 1 1 1.414-1.414L19 15.586z" />
  </Svg>
);
export default SvgRemoveColumn;
