import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBrokenLink = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14 22v-1a1 1 0 1 1 2 0v1a1 1 0 1 1-2 0M5.293 10.293a1 1 0 1 1 1.414 1.414L3.914 14.5 9.5 20.086l2.793-2.793a1 1 0 1 1 1.414 1.414L10.914 21.5a2 2 0 0 1-2.828 0L2.5 15.914a2 2 0 0 1 0-2.828zm13.5 8.5a1 1 0 0 1 1.414 0l1 1a1 1 0 1 1-1.414 1.414l-1-1a1 1 0 0 1 0-1.414M22 14a1 1 0 1 1 0 2h-1a1 1 0 1 1 0-2zM13.086 2.5a2 2 0 0 1 2.828 0L21.5 8.086a2 2 0 0 1 0 2.828l-2.793 2.793a1 1 0 1 1-1.414-1.414L20.086 9.5 14.5 3.914l-2.793 2.793a1 1 0 1 1-1.414-1.414zM3 8a1 1 0 0 1 0 2H2a1 1 0 1 1 0-2zm-.207-5.207a1 1 0 0 1 1.414 0l1 1a1 1 0 1 1-1.414 1.414l-1-1a1 1 0 0 1 0-1.414M8 3V2a1 1 0 0 1 2 0v1a1 1 0 1 1-2 0" />
  </Svg>
);
export default SvgBrokenLink;
