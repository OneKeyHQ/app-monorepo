import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddColumn = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 13v3h3v2h-3v3h-2v-3h-3v-2h3v-3z" />
    <Path d="M22 4v7h-2V6h-7v14H2V4z" />
  </Svg>
);
export default SvgAddColumn;
