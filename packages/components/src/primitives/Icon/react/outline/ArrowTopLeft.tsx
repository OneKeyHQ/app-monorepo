import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTopLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 14.818V5.982C5 5.44 5.44 5 5.982 5h8.836a.982.982 0 1 1 0 1.964H8.352l9.86 9.86a.981.981 0 1 1-1.388 1.388l-9.86-9.86v6.466a.982.982 0 1 1-1.964 0" />
  </Svg>
);
export default SvgArrowTopLeft;
