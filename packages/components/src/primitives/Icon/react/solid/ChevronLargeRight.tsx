import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronLargeRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9.504 2.333a.98.98 0 0 1 1.33.38l4.632 8.336c.328.592.328 1.31 0 1.902l-4.631 8.336a.979.979 0 1 1-1.712-.951L13.754 12l-4.63-8.335a.98.98 0 0 1 .38-1.332" />
  </Svg>
);
export default SvgChevronLargeRight;
