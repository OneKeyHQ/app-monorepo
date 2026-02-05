import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSwitchVer = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 20V6.164L3.707 8.457a1 1 0 1 1-1.414-1.414l3.47-3.47.132-.12a1.75 1.75 0 0 1 2.342.12l3.47 3.47a1 1 0 1 1-1.414 1.414L8 6.164V20a1 1 0 1 1-2 0M16 4a1 1 0 1 1 2 0v13.836l2.293-2.293a1 1 0 1 1 1.414 1.414l-3.47 3.47a1.75 1.75 0 0 1-2.474 0l-3.47-3.47a1 1 0 1 1 1.414-1.414L16 17.836z" />
  </Svg>
);
export default SvgSwitchVer;
