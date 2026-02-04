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
      d="M12.66 8.334a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2h-1.33a2 2 0 0 1-2-2v-8.666a2 2 0 0 1 2-2zM11.33 19h1.33v-8.666h-1.33zm-5-6.223a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4.223a2 2 0 0 1 2-2zM5 19h1.33v-4.223H5zM19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-1.33a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm-1.33 16H19V5h-1.33z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartColumnarSignal;
