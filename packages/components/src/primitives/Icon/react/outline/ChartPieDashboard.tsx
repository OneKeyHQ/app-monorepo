import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartPieDashboard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 0 0-7-7.937v7.23l6.818 2.41A8 8 0 0 0 20 12M4 12a8 8 0 0 0 15.15 3.587l-7.483-2.645A1 1 0 0 1 11 12V4.063A8 8 0 0 0 4 12m18 0a10 10 0 0 1-10 10C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10" />
  </Svg>
);
export default SvgChartPieDashboard;
