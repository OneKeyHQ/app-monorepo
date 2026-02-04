import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRowsWide = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22 13v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5zm-2-9a2 2 0 0 1 2 2v5H2V6a2 2 0 0 1 2-2z" />
  </Svg>
);
export default SvgRowsWide;
