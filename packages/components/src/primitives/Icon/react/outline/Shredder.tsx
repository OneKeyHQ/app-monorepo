import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShredder = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 22H9v-6h2zm8 0h-2v-6h2zM7 20H5v-4h2zm8 0h-2v-4h2zm7-6H2v-2h20zm-2-4h-2V4H6v6H4V2h16z" />
  </Svg>
);
export default SvgShredder;
