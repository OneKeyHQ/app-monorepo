import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMenu = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 17a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2zm0-6a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2zm0-6a1 1 0 1 1 0 2H3a1 1 0 0 1 0-2z" />
  </Svg>
);
export default SvgMenu;
