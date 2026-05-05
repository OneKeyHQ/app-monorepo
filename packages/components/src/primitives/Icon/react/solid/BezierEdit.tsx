import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBezierEdit = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 3v2h6V3h6v6h-2v1h-2V9h-2V7H9v2H7v6h2v2h2v2H9v2H3v-6h2V9H3V3zm7.793 10.46a2.65 2.65 0 1 1 3.747 3.747L16.747 21H13v-3.747z" />
  </Svg>
);
export default SvgBezierEdit;
