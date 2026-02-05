import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFork = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.5 18.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0M8 5.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0m11 0a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0m2 0a3.5 3.5 0 0 1-2.5 3.354V11a2 2 0 0 1-2 2H13v2.146a3.501 3.501 0 1 1-2 0V13H7.5a2 2 0 0 1-2-2V8.854a3.5 3.5 0 1 1 2 0V11H11c.365 0 .706.1 1 .27a2 2 0 0 1 1-.27h3.5V8.854A3.5 3.5 0 1 1 21 5.5" />
  </Svg>
);
export default SvgFork;
