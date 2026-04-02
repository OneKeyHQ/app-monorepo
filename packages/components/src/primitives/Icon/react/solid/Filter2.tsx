import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFilter2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 20H8v-2h8zm3-9v2H5v-2zm3-5H2V4h20z" />
  </Svg>
);
export default SvgFilter2;
