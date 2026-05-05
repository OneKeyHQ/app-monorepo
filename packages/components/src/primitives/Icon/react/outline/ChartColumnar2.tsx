import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartColumnar2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15.66 8h5.33v13H3v-8h5.33V3h7.33zM5 19h3.33v-4H5zm5.33 0h3.33V5h-3.33zm5.33 0h3.33v-9h-3.33z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartColumnar2;
