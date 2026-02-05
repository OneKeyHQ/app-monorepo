import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgConsole = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 5v14h14V5zm1.793 2.293a1 1 0 0 1 1.414 0l1.75 1.75a1 1 0 0 1 0 1.414l-1.75 1.75a1 1 0 1 1-1.414-1.414L7.836 9.75 6.793 8.707a1 1 0 0 1 0-1.414M14 10.5a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2zm7 8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgConsole;
