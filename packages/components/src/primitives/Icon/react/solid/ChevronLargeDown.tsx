import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronLargeDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2.333 9.504a.98.98 0 0 1 1.331-.38L12 13.753l8.336-4.63a.979.979 0 0 1 .95 1.711l-8.335 4.63a1.96 1.96 0 0 1-1.902 0l-8.335-4.63a.98.98 0 0 1-.38-1.331Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronLargeDown;
