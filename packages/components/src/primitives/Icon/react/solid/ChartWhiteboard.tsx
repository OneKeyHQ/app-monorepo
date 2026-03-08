import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartWhiteboard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 2v2h9v15h-4.612l.877 2.633-1.898.632L15.28 19H13v2h-2v-2H8.72l-1.087 3.265-1.898-.632L6.612 19H2V4h9V2z" />
  </Svg>
);
export default SvgChartWhiteboard;
