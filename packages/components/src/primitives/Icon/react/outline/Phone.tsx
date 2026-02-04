import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPhone = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 3v18h10V3zm7 15a1 1 0 1 1 0 2h-4a1 1 0 1 1 0-2zm5 3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgPhone;
