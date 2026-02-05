import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTextIndentLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 17a1 1 0 1 1 0 2H10a1 1 0 1 1 0-2zM2.59 8.428a1 1 0 0 1 1.073.164l3 2.66a1 1 0 0 1 0 1.497l-3 2.65A1 1 0 0 1 2 14.65V9.34a1 1 0 0 1 .59-.912M21 11a1 1 0 1 1 0 2H10a1 1 0 1 1 0-2zm0-6a1 1 0 1 1 0 2H10a1 1 0 0 1 0-2z" />
  </Svg>
);
export default SvgTextIndentLeft;
