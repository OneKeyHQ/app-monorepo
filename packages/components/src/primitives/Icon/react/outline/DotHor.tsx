import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDotHor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 12a2 2 0 1 1 4 0 2 2 0 0 1-4 0m8 0a2 2 0 1 1 4 0 2 2 0 0 1-4 0m8 0a2 2 0 1 1 4 0 2 2 0 0 1-4 0" />
  </Svg>
);
export default SvgDotHor;
