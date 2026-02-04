import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShredder = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 2c-1.105 0-2 .894-2 1.998V10h16V3.998A2 2 0 0 0 18 2zM3 12a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2zm4 5a1 1 0 1 0-2 0v2a1 1 0 1 0 2 0zm4 0a1 1 0 1 0-2 0v4a1 1 0 1 0 2 0zm4 0a1 1 0 1 0-2 0v2a1 1 0 1 0 2 0zm4 0a1 1 0 1 0-2 0v4a1 1 0 1 0 2 0z" />
  </Svg>
);
export default SvgShredder;
