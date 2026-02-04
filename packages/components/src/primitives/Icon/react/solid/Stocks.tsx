import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgStocks = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4v-8.17a3.001 3.001 0 0 0 0-5.66zm-2 18v-8.171a3 3 0 0 1-.293-.122l-3 3a1 1 0 0 1-1.414 0L7 14.414l-4 4V19a2 2 0 0 0 2 2zM3 15.586V5a2 2 0 0 1 2-2h8v4.17a3 3 0 0 0-1.707 4.123L9 13.586l-1.293-1.293a1 1 0 0 0-1.414 0zM13 10a1 1 0 1 1 2 0 1 1 0 0 1-2 0" />
  </Svg>
);
export default SvgStocks;
