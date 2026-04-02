import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartTrendingUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22 13h-2V9.414l-7 7-4-4-6 6L1.586 17 9 9.586l4 4L18.586 8H15V6h7z" />
  </Svg>
);
export default SvgChartTrendingUp;
