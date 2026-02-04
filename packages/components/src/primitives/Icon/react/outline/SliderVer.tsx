import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSliderVer = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 9a2 2 0 1 0-4 0 2 2 0 1 0 4 0m10 8a2 2 0 1 0-4 0 2 2 0 1 0 4 0m2 0a4 4 0 0 1-4 4 4 4 0 0 1-1-7.874V4a1 1 0 1 1 2 0v9.126A4 4 0 0 1 21 17M11 9a4 4 0 0 1-3 3.874V20a1 1 0 1 1-2 0v-7.126a4 4 0 0 1 0-7.748V4a1 1 0 0 1 2 0v1.126A4 4 0 0 1 11 9" />
  </Svg>
);
export default SvgSliderVer;
