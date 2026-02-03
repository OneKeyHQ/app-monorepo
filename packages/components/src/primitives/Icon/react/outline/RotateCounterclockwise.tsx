import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRotateCounterclockwise = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19.028 12a7 7 0 0 0-7-7c-1.973 0-3.401.68-4.784 2H9a1 1 0 0 1 0 2H5.5A1.5 1.5 0 0 1 4 7.5V4a1 1 0 1 1 2 0v1.427C7.622 3.924 9.475 3 12.028 3A9 9 0 1 1 3.54 15a1 1 0 0 1 1.884-.667A7 7 0 0 0 19.028 12" />
  </Svg>
);
export default SvgRotateCounterclockwise;
