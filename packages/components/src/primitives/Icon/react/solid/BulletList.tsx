import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBulletList = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6m7 2a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2zm-7 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6m7 2a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2z" />
  </Svg>
);
export default SvgBulletList;
