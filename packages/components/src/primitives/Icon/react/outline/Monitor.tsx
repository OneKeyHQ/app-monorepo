import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMonitor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M17.904 3.676 14.916 6H22v15H2V6h7.085L6.097 3.676l1.227-1.58L12 5.733l4.677-3.635zM4 19h16V8H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMonitor;
