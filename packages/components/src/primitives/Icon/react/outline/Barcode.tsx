import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBarcode = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 18h4v2H2v-6h2zm18 2h-6v-2h4v-4h2zM9 15H7V9h2zm8 0h-2V9h2zm-4-2h-2V9h2zM8 6H4v4H2V4h6zm14 4h-2V6h-4V4h6z" />
  </Svg>
);
export default SvgBarcode;
