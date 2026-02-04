import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFork = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3 5.5a3.5 3.5 0 1 1 4.5 3.355V11H11c.364 0 .706.097 1 .268A2 2 0 0 1 13 11h3.5V8.855A3.502 3.502 0 0 1 17.5 2a3.5 3.5 0 0 1 1 6.855V11a2 2 0 0 1-2 2H13v2.145A3.502 3.502 0 0 1 12 22a3.5 3.5 0 0 1-1-6.855V13H7.5a2 2 0 0 1-2-2V8.855A3.5 3.5 0 0 1 3 5.5" />
  </Svg>
);
export default SvgFork;
