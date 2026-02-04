import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChatGroup = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4.002 9v8h2a1 1 0 0 1 1 1v.8l3.015-1.674.114-.055a1 1 0 0 1 .371-.071h5.5v-2.959L16 14l.002-.047V9zm14 4h2V5h-12v2h8a2 2 0 0 1 2 2zm4 0a2 2 0 0 1-2 2h-2v2a2 2 0 0 1-2 2h-5.241l-4.273 2.374a1 1 0 0 1-1.486-.874V19h-1a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgChatGroup;
