import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronLargeTop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11.05 8.534a1.96 1.96 0 0 1 1.9 0l8.337 4.63a.979.979 0 0 1-.951 1.712L12 10.246l-8.336 4.63a.979.979 0 1 1-.95-1.712l8.335-4.63Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronLargeTop;
