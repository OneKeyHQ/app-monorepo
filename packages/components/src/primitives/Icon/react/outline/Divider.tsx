import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDivider = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 18a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2zm8 0a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2zm8 0a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2zm0-7a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2zM5 4a1 1 0 0 1 0 2H3a1 1 0 0 1 0-2zm8 0a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2zm8 0a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2z" />
  </Svg>
);
export default SvgDivider;
