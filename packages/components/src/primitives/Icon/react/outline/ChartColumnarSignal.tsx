import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartColumnarSignal = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14.66 21.001H9.33V8.334h5.33zm-3.33-2h1.33v-8.667h-1.33zM8.33 21H3v-8.223h5.33zM5 19h1.33v-4.223H5zm16 2h-5.33V3H21zm-3.33-2H19V5h-1.33z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartColumnarSignal;
