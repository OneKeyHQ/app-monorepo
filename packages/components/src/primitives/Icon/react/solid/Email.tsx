import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEmail = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22 20H2V6.11l10 8.182L22 6.11z" />
    <Path d="M21.42 4 12 11.708 2.58 4z" />
  </Svg>
);
export default SvgEmail;
