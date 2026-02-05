import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartWhiteboard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 6v11h16V6zm18 11a2 2 0 0 1-2 2h-2.613l.561 1.684a1 1 0 1 1-1.896.633L15.279 19H13v1a1 1 0 0 1-2 0v-1H8.72l-.772 2.317a1 1 0 0 1-1.896-.633L6.613 19H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7V3a1 1 0 1 1 2 0v1h7a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgChartWhiteboard;
