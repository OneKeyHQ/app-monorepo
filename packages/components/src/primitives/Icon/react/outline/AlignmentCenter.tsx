import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAlignmentCenter = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 20H3v-2h18zm-4-7H7v-2h10zm4-7H3V4h18z" />
  </Svg>
);
export default SvgAlignmentCenter;
