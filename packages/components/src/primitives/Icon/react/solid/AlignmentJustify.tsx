import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAlignmentJustify = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 20H3v-2h18zm0-7H3v-2h18zm0-7H3V4h18z" />
  </Svg>
);
export default SvgAlignmentJustify;
