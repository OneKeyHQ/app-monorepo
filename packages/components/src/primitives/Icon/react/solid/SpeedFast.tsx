import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSpeedFast = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20.662 17A10 10 0 0 1 12 22a10 10 0 0 1-8.662-5zM12 2c5.523 0 10 4.477 10 10a10 10 0 0 1-.458 3h-7.924l2.277-4.553a.996.996 0 0 0-.448-1.342 1 1 0 0 0-1.097.134 1 1 0 0 0-.245.314L11.383 15H2.458A10 10 0 0 1 2 12C2 6.477 6.477 2 12 2" />
  </Svg>
);
export default SvgSpeedFast;
