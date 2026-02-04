import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBulletList = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 17a1 1 0 1 0-2 0 1 1 0 0 0 2 0m13-1a1 1 0 1 1 0 2h-7a1 1 0 1 1 0-2zM7 7a1 1 0 1 0-2 0 1 1 0 0 0 2 0m13-1a1 1 0 1 1 0 2h-7a1 1 0 1 1 0-2zM9 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0M9 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0" />
  </Svg>
);
export default SvgBulletList;
