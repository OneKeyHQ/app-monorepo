import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgColumnWide = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7zm2 16h7a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-7z" />
  </Svg>
);
export default SvgColumnWide;
