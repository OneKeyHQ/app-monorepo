import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartTrending = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m18.214 17.335 2.339-4.677 1.789.895-4.557 9.112-4.959-15.868-4.704 10.35-3.167-5.278-1.678 2.518-1.664-1.11 3.432-5.146 2.832 4.721 5.296-11.65 5.04 16.133Z" />
  </Svg>
);
export default SvgChartTrending;
