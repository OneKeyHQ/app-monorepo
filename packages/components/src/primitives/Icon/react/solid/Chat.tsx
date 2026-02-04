import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChat = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20.002 3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H12.28l-4.762 2.858A1 1 0 0 1 6.002 21v-2h-2a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
  </Svg>
);
export default SvgChat;
