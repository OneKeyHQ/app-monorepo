import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOption1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m7.42 4 .134.005a2 2 0 0 1 1.602 1.003L16.58 18H20a1 1 0 1 1 0 2h-3.42a2 2 0 0 1-1.736-1.008L7.42 6H4a1 1 0 0 1 0-2zM20 4a1 1 0 1 1 0 2h-4a1 1 0 1 1 0-2z" />
  </Svg>
);
export default SvgOption1;
