import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMinusCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0m-4-1a1 1 0 1 1 0 2H8a1 1 0 0 1 0-2zm6 1c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
  </Svg>
);
export default SvgMinusCircle;
