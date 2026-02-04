import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronRightSmall = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9.288 7.379a.98.98 0 0 1 1.388 0l3.407 3.406a1.72 1.72 0 0 1 0 2.43l-3.407 3.407a.982.982 0 1 1-1.388-1.389L12.52 12 9.288 8.767a.98.98 0 0 1 0-1.388" />
  </Svg>
);
export default SvgChevronRightSmall;
