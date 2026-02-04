import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgScan = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3 8V5a2 2 0 0 1 2-2h3a1 1 0 0 1 0 2H5v3a1 1 0 0 1-2 0m16 0V5h-3a1 1 0 1 1 0-2h3a2 2 0 0 1 2 2v3a1 1 0 1 1-2 0m0 11v-3a1 1 0 1 1 2 0v3a2 2 0 0 1-2 2h-3a1 1 0 1 1 0-2zM3 19v-3a1 1 0 1 1 2 0v3h3a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2M15 9a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2zm-2 4a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2z" />
  </Svg>
);
export default SvgScan;
