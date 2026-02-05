import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChat = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4.002 5v12h3a1 1 0 0 1 1 1v1.233l3.486-2.09.12-.062a1 1 0 0 1 .394-.081h8V5zm18 12a2 2 0 0 1-2 2H12.28l-4.763 2.858A1.001 1.001 0 0 1 6.002 21v-2h-2a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgChat;
