import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartTrending = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m18.215 17.335 2.338-4.677 1.789.895-4.557 9.113-4.958-15.868-4.705 10.35-3.167-5.279-1.678 2.518-1.664-1.11 3.432-5.146 2.833 4.721 5.296-11.65z" />
  </Svg>
);
export default SvgChartTrending;
