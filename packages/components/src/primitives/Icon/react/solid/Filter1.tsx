import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFilter1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 3a2 2 0 0 0-2 2v2.586A2 2 0 0 0 3.586 9L9 14.414v5.643a2 2 0 0 0 2.702 1.873l2-.75A2 2 0 0 0 15 19.307v-4.893L20.414 9A2 2 0 0 0 21 7.586V5a2 2 0 0 0-2-2z" />
  </Svg>
);
export default SvgFilter1;
