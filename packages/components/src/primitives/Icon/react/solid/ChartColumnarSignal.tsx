import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartColumnarSignal = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.66 21.001H9.33V8.334h5.33zm-6.33-8.224V21H3v-8.223zM21 21h-5.33V3H21z" />
  </Svg>
);
export default SvgChartColumnarSignal;
