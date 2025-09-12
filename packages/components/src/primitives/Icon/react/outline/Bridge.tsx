import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBridge = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 6a7 7 0 0 0-7 7 1 1 0 1 1-2 0 9 9 0 0 1 18 0 1 1 0 1 1-2 0 7 7 0 0 0-7-7M6 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0M20 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4" />
  </Svg>
);
export default SvgBridge;
