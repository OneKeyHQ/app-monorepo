import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMinusLarge = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 11a1 1 0 1 1 0 2H4a1 1 0 1 1 0-2z" />
  </Svg>
);
export default SvgMinusLarge;
