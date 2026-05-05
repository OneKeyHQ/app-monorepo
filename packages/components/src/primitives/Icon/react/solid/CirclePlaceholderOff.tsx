import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCirclePlaceholderOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m21.707 20.293-1.414 1.414-1.965-1.964A9.96 9.96 0 0 1 12 22C6.477 22 2 17.523 2 12c0-2.4.847-4.606 2.257-6.33L2.293 3.708l1.414-1.414 18 18ZM12 2c5.523 0 10 4.477 10 10a9.96 9.96 0 0 1-1.132 4.626L7.374 3.132A9.96 9.96 0 0 1 12 2" />
  </Svg>
);
export default SvgCirclePlaceholderOff;
