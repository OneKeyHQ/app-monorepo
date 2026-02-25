import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartColumnar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.67 14.001v7H3v-7zm6.67 7H9.67v-12.5h4.67zm6.67 0h-4.67v-18h4.67z" />
  </Svg>
);
export default SvgChartColumnar;
