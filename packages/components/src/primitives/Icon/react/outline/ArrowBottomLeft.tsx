import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowBottomLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16.824 5.788a.982.982 0 1 1 1.388 1.388l-9.86 9.86h6.466a.982.982 0 1 1 0 1.964H5.982A.98.98 0 0 1 5 18.018V9.182a.982.982 0 0 1 1.964 0v6.466z" />
  </Svg>
);
export default SvgArrowBottomLeft;
