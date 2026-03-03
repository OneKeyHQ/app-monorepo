import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgStocks = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.707 12.708a3 3 0 0 0 .293.121V21H3v-2.586l4-4 2 2zM21 21h-6v-8.17a3.001 3.001 0 0 0 0-5.66V3h6zM13 7.17a3 3 0 0 0-1.707 4.123L9 13.586l-2-2-4 4V3h10z" />
    <Path d="M14 9a1 1 0 1 1 0 2 1 1 0 0 1 0-2" />
  </Svg>
);
export default SvgStocks;
