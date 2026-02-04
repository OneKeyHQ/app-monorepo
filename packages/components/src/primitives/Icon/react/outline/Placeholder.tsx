import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPlaceholder = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3 19v-1a1 1 0 1 1 2 0v1h1a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2m10.5 0a1 1 0 1 1 0 2h-3a1 1 0 1 1 0-2zm5.5 0v-1a1 1 0 1 1 2 0v1a2 2 0 0 1-2 2h-1a1 1 0 1 1 0-2zM3 13.5v-3a1 1 0 0 1 2 0v3a1 1 0 1 1-2 0m16 0v-3a1 1 0 1 1 2 0v3a1 1 0 1 1-2 0M3 6V5a2 2 0 0 1 2-2h1a1 1 0 0 1 0 2H5v1a1 1 0 0 1-2 0m16 0V5h-1a1 1 0 1 1 0-2h1a2 2 0 0 1 2 2v1a1 1 0 1 1-2 0m-5.5-3a1 1 0 1 1 0 2h-3a1 1 0 0 1 0-2z" />
  </Svg>
);
export default SvgPlaceholder;
