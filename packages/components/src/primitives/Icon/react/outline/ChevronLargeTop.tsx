import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronLargeTop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.049 8.534a1.96 1.96 0 0 1 1.902 0l8.335 4.63a.98.98 0 0 1-.95 1.713L12 10.246l-8.336 4.631a.98.98 0 0 1-.95-1.712z" />
  </Svg>
);
export default SvgChevronLargeTop;
