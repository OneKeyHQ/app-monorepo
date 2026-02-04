import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartLine2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3.5 3a1 1 0 0 1 1 1v15h16a1 1 0 1 1 0 2h-16a2 2 0 0 1-2-2V4a1 1 0 0 1 1-1" />
    <Path d="M8.5 10a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-5a1 1 0 0 1 1-1m5-6a1 1 0 0 1 1 1v11a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1m5 8a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1" />
  </Svg>
);
export default SvgChartLine2;
