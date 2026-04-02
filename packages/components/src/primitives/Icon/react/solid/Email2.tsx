import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEmail2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22 20H2V9.118l10 5 10-5z" />
    <Path d="m22 6.882-10 5-10-5V4h20z" />
  </Svg>
);
export default SvgEmail2;
