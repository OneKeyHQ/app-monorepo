import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMouse = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 9A5 5 0 0 0 7 9v6a5 5 0 0 0 10 0zm-6 0V7a1 1 0 1 1 2 0v2a1 1 0 1 1-2 0m8 6a7 7 0 1 1-14 0V9a7 7 0 0 1 14 0z" />
  </Svg>
);
export default SvgMouse;
