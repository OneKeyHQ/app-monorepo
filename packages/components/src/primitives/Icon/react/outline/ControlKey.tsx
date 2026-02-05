import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgControlKey = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 5v14h14V5zm8.37 2.225a1 1 0 0 1 1.337.068l2 2a1 1 0 1 1-1.414 1.414L14 9.414l-1.293 1.293a1 1 0 1 1-1.414-1.414l2-2zM21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgControlKey;
