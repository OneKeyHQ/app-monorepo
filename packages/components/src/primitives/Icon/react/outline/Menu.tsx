import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMenu = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22 19H2v-2h20zm0-6H2v-2h20zm0-6H2V5h20z" />
  </Svg>
);
export default SvgMenu;
