import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgResizeBig = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 14h-2V5H5v14h9v2H3V3h18z" />
    <Path d="M16 11h-3.586l7 7L18 19.414l-7-7V16H9V9h7z" />
  </Svg>
);
export default SvgResizeBig;
