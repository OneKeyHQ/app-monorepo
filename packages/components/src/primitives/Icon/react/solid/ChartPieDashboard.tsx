import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartPieDashboard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m11 12.708 10.05 3.551A10 10 0 0 1 12 22C6.477 22 2 17.524 2 12c0-5.185 3.947-9.448 9-9.95v10.659Z" />
    <Path d="M13 2.05c5.053.501 9 4.764 9 9.95 0 .817-.098 1.613-.283 2.374L13 11.292z" />
  </Svg>
);
export default SvgChartPieDashboard;
