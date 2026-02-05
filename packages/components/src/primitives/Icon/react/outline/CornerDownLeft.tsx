import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCornerDownLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.25 10.293a1 1 0 1 1 1.414 1.414L6.371 14h12.586V5a1 1 0 1 1 2 0v9a2 2 0 0 1-2 2H6.371l2.293 2.293a1 1 0 1 1-1.414 1.414l-4-4a1 1 0 0 1 0-1.414z" />
  </Svg>
);
export default SvgCornerDownLeft;
