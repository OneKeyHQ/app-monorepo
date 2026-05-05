import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgReceiptStorno = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20 2v20.498l-3.266-2.24-2.401 2.06-2.333-2-2.333 2-2.401-2.06L4 22.499V2zM8 14v2h8v-2zm4-6.164-1.72-1.72L8.866 7.53l1.72 1.72-1.72 1.72 1.414 1.414 1.72-1.72 1.72 1.72 1.414-1.414-1.72-1.72 1.72-1.72-1.414-1.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgReceiptStorno;
