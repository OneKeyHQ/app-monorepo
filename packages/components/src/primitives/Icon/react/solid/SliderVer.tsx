import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSliderVer = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 3v2.126a4 4 0 0 1 0 7.748V21H6v-8.126a4 4 0 0 1 0-7.748V3zm10 10.126a4 4 0 1 1-2 0V3h2z" />
  </Svg>
);
export default SvgSliderVer;
