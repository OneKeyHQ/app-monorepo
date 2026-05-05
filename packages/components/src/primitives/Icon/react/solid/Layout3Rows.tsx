import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayout3Rows = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 16.33V21H3v-4.67zm0-2H3V9.67h18zm0-6.66H3V3h18z" />
  </Svg>
);
export default SvgLayout3Rows;
