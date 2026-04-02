import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartTrending2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m5 14.586 4.5-4.5 2.5 2.5 5-5L20.414 11 19 12.414l-2-2-5 5-2.5-2.5-4.5 4.5V19h16v2H3V3h2z" />
  </Svg>
);
export default SvgChartTrending2;
