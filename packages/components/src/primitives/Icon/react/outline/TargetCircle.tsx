import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTargetCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0m-9 5v-2.5a1 1 0 1 1 2 0V17a1 1 0 1 1-2 0m-1.5-6a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2zm7.5 0a1 1 0 1 1 0 2h-2.5a1 1 0 1 1 0-2zm-6-1.5V7a1 1 0 1 1 2 0v2.5a1 1 0 1 1-2 0M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
  </Svg>
);
export default SvgTargetCircle;
