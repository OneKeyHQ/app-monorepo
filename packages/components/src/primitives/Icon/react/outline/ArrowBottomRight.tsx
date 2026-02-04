import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowBottomRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5.788 5.788a.98.98 0 0 1 1.388 0l9.86 9.86V9.182a.982.982 0 1 1 1.964 0v8.836c0 .542-.44.982-.982.982H9.182a.982.982 0 0 1 0-1.964h6.466l-9.86-9.86a.98.98 0 0 1 0-1.388" />
  </Svg>
);
export default SvgArrowBottomRight;
