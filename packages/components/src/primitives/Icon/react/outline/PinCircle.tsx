import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPinCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0m-9 5v-4.145a3.501 3.501 0 1 1 2-.002V17a1 1 0 1 1-2 0m2.06-8.56a1.5 1.5 0 1 0-2.122 2.122A1.5 1.5 0 0 0 13.06 8.44M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
  </Svg>
);
export default SvgPinCircle;
