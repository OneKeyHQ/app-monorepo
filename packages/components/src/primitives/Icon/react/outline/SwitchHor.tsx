import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSwitchHor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.043 12.293a1 1 0 1 1 1.414 1.414L6.164 16H20a1 1 0 1 1 0 2H6.164l2.293 2.293a1 1 0 1 1-1.414 1.414l-3.47-3.47a1.75 1.75 0 0 1 0-2.474zm8.5-10a1 1 0 0 1 1.414 0l3.47 3.47a1.75 1.75 0 0 1 0 2.474l-3.47 3.47a1 1 0 1 1-1.414-1.414L17.836 8H4a1 1 0 1 1 0-2h13.836l-2.293-2.293a1 1 0 0 1 0-1.414" />
  </Svg>
);
export default SvgSwitchHor;
