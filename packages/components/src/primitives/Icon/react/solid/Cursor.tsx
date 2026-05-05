import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCursor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M24.198 9.911 1.836 1.836 9.91 24.198l4.348-9.939z" />
  </Svg>
);
export default SvgCursor;
