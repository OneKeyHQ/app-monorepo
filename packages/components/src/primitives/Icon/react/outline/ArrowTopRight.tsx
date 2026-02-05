import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTopRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 14.818a.982.982 0 1 1-1.964 0V8.352l-9.86 9.86a.982.982 0 1 1-1.388-1.388l9.86-9.86H9.182a.982.982 0 0 1 0-1.964h8.836c.542 0 .982.44.982.982z" />
  </Svg>
);
export default SvgArrowTopRight;
