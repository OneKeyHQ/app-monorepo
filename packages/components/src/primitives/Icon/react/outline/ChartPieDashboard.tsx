import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartPieDashboard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m-1 2.063A8 8 0 0 0 12 20a8 8 0 0 0 7.15-4.413L11 12.707zm2 7.23 6.816 2.41A8 8 0 0 0 13 4.063z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartPieDashboard;
