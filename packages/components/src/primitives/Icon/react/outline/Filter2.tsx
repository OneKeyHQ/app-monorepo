import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFilter2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15 18a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2zm3-7a1 1 0 1 1 0 2H6a1 1 0 1 1 0-2zm3-7a1 1 0 1 1 0 2H3a1 1 0 0 1 0-2z" />
  </Svg>
);
export default SvgFilter2;
