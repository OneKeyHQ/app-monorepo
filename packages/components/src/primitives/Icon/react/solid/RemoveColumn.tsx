import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRemoveColumn = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m22.414 15-2 2 2 2L21 20.414l-2-2-2 2L15.586 19l2-2-2-2L17 13.586l2 2 2-2z" />
    <Path d="M22 4v7h-2V6h-7v14H2V4z" />
  </Svg>
);
export default SvgRemoveColumn;
