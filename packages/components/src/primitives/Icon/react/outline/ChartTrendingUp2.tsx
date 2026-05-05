import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartTrendingUp2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 18h18v2H2V4h2z" />
    <Path d="M20 12h-2V9.414l-5 5-2-2-4 4L5.586 15 11 9.586l2 2L16.586 8H14V6h6z" />
  </Svg>
);
export default SvgChartTrendingUp2;
