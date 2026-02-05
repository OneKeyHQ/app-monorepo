import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMap = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m14 4.863-4-1.334v15.108l4 1.334zm2 15.107 4.633-1.543A2 2 0 0 0 22 16.529V5.637a2 2 0 0 0-2.633-1.897L16 4.863zM3.368 5.073 8 3.53v15.108L4.632 19.76A2 2 0 0 1 2 17.863V6.97a2 2 0 0 1 1.368-1.898Z" />
  </Svg>
);
export default SvgMap;
