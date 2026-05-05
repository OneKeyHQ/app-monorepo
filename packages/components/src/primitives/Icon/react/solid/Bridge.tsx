import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBridge = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 16a2 2 0 1 1 0 4 2 2 0 0 1 0-4m16 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4M12 4a9 9 0 0 1 9 9 1 1 0 1 1-2 0 7 7 0 1 0-14 0 1 1 0 1 1-2 0 9 9 0 0 1 9-9" />
  </Svg>
);
export default SvgBridge;
