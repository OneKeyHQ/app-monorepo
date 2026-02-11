import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShareScreen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 6v12h16V6zm7 9.5v-4.586l-1.293 1.293a1 1 0 1 1-1.414-1.414l3-3 .076-.068a1 1 0 0 1 1.338.068l3 3a1 1 0 1 1-1.414 1.414L13 10.914V15.5a1 1 0 1 1-2 0M22 18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgShareScreen;
