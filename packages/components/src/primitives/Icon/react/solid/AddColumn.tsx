import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddColumn = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a1 1 0 0 0 1-1V6h7v4a1 1 0 1 0 2 0V6a2 2 0 0 0-2-2z" />
    <Path d="M20 14a1 1 0 1 0-2 0v2h-2a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2z" />
  </Svg>
);
export default SvgAddColumn;
