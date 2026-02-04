import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMinusSmall = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 11a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2z" />
  </Svg>
);
export default SvgMinusSmall;
