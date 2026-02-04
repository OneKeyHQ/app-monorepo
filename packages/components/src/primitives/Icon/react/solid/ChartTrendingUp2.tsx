import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartTrendingUp2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3 4a1 1 0 0 1 1 1v13h17a1 1 0 1 1 0 2H4a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1m12 4a1 1 0 1 1 0-2h4a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V9.414L14.414 13a2 2 0 0 1-2.828 0L11 12.414l-3.293 3.293a1 1 0 0 1-1.414-1.414L9.586 11a2 2 0 0 1 2.828 0l.586.586L16.586 8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartTrendingUp2;
