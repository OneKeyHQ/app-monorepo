import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartLine2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 19h17v2H3V3h2z" />
    <Path d="M10 17H8v-7h2zm5 0h-2V4h2zm5-5v5h-2v-5z" />
  </Svg>
);
export default SvgChartLine2;
