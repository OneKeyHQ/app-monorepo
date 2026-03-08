import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBezierAdd = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 9v2h2v2h-2v2h-2v-2H9v-2h2V9z" />
    <Path
      fillRule="evenodd"
      d="M9 5h6V3h6v6h-2v6h2v6h-6v-2H9v2H3v-6h2V9H3V3h6zm0 4H7v6h2v2h6v-2h2V9h-2V7H9z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBezierAdd;
