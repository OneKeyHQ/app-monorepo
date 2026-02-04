import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShredder = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 21v-4a1 1 0 1 1 2 0v4a1 1 0 1 1-2 0m8 0v-4a1 1 0 1 1 2 0v4a1 1 0 1 1-2 0M5 19v-2a1 1 0 1 1 2 0v2a1 1 0 1 1-2 0m8 0v-2a1 1 0 1 1 2 0v2a1 1 0 1 1-2 0m8-7a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2zm-3-3V4H6v5a1 1 0 0 1-2 0V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 1 1-2 0" />
  </Svg>
);
export default SvgShredder;
