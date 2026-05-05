import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgReceipt = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m20 22.498-3.266-2.24-2.401 2.06-2.333-2-2.333 2-2.401-2.06L4 22.499V2h16zM8 11v2h4v-2zm0-4v2h8V7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgReceipt;
