import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRowsWide = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22 13v7H2v-7zm0-2H2V4h20z" />
  </Svg>
);
export default SvgRowsWide;
