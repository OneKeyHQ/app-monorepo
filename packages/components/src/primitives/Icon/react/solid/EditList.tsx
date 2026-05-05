import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEditList = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22.414 11.865 12.28 22H7v-5.28L17.135 6.587l5.28 5.28ZM8.002 11v2H3v-2zM11.5 9H3V7h8.5zM21 5H3V3h18z" />
  </Svg>
);
export default SvgEditList;
