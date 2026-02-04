import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronLargeDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20.336 9.123a.979.979 0 0 1 .95 1.712l-8.335 4.63a1.96 1.96 0 0 1-1.902 0l-8.335-4.63a.979.979 0 1 1 .95-1.712L12 13.755z" />
  </Svg>
);
export default SvgChevronLargeDown;
