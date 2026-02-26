import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRotateCounterclockwise = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18 5.426C16.372 3.919 14.516 3 11.972 3a9 9 0 1 0 8.487 12l.334-.943-1.886-.666-.333.942A7 7 0 1 1 11.971 5c1.982 0 3.407.686 4.785 2H14v2h6V3h-2z" />
  </Svg>
);
export default SvgRotateCounterclockwise;
