import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCodeBrackets = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m15.213 3.272-4.486 17.94-1.94-.485 4.486-17.94zM7.414 8l-4 4 4 4L6 17.414.586 12 6 6.586zm16 4L18 17.414 16.586 16l4-4-4-4L18 6.586z" />
  </Svg>
);
export default SvgCodeBrackets;
