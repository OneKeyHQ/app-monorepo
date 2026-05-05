import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRotateCounterclockwise = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 5.426C7.628 3.919 9.484 3 12.028 3a9 9 0 1 1-8.487 12l-.334-.943 1.886-.666.333.942A7 7 0 1 0 12.029 5c-1.982 0-3.407.686-4.785 2H10v2H4V3h2z" />
  </Svg>
);
export default SvgRotateCounterclockwise;
