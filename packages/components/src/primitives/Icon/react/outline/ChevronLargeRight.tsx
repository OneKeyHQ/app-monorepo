import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronLargeRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9.504 2.333a.98.98 0 0 1 1.33.38l4.632 8.336a1.96 1.96 0 0 1 0 1.902l-4.631 8.335a.979.979 0 0 1-1.712-.95L13.754 12l-4.63-8.336a.98.98 0 0 1 .38-1.33Z" />
  </Svg>
);
export default SvgChevronLargeRight;
