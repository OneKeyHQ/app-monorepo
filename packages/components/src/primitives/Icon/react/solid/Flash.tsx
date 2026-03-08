import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFlash = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.168 9h7.009L8.48 23.811 9.837 15H2.828L15.523.188z" />
  </Svg>
);
export default SvgFlash;
