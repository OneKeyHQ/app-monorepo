import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartLine = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m4.006 10.001-.006 10-2-.002.006-10zM10.001 20h-2V4h2zm5.997 0h-2v-7h2zm6.003 0h-2V7h2z" />
  </Svg>
);
export default SvgChartLine;
