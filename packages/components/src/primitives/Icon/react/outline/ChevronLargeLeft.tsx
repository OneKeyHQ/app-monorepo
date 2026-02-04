import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronLargeLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.165 2.713a.98.98 0 0 1 1.712.95L10.246 12l4.631 8.336a.98.98 0 0 1-1.712.95l-4.63-8.335a1.96 1.96 0 0 1 0-1.902z" />
  </Svg>
);
export default SvgChevronLargeLeft;
