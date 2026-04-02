import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartPieDashboard2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 12h8v1a9 9 0 1 1-9-9h1zm-2-5.928A7 7 0 0 0 11 20a7 7 0 0 0 6.928-6H10z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M15.142 2.08a8.005 8.005 0 0 1 6.777 6.778L22.082 10H14V1.918zM16 8h3.657A6.02 6.02 0 0 0 16 4.34z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartPieDashboard2;
