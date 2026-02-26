import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartColumnar3 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20.99 19H23v2H1v-2h2v-5h5.33V8.5h5.33V3h7.33zM5 19h3.33v-3H5zm5.33 0h3.33v-8.5h-3.33zm5.33 0h3.33V5h-3.33z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChartColumnar3;
