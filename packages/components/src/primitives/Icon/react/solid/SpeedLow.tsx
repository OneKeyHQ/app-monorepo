import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSpeedLow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20.66 17a10 10 0 0 1-8.662 5 10 10 0 0 1-8.662-5zM12 2c5.523 0 10 4.477 10 10a10 10 0 0 1-.458 3h-8.924l-3.17-6.342-1.79.895L10.382 15H2.458A10 10 0 0 1 2 12C2 6.477 6.477 2 12 2" />
  </Svg>
);
export default SvgSpeedLow;
