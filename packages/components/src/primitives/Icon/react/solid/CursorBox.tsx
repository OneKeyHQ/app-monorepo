import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCursorBox = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.142 12.669a1.25 1.25 0 0 1 1.527-1.527l8.484 2.233c1.09.287 1.273 1.754.29 2.3l-3.708 2.06-2.06 3.707c-.546.984-2.013.8-2.3-.289z" />
    <Path d="M19 3a2 2 0 0 1 2 2v5a1 1 0 1 1-2 0V5H5v14h5a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
  </Svg>
);
export default SvgCursorBox;
