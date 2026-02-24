import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartColumnar4 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5 3h5v5.33h5.5v5.33H21v7.33H5V23H3V1h2zm0 15.99h14v-3.33H5zm0-5.33h8.5v-3.33H5zm0-5.33h3V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartColumnar4;
