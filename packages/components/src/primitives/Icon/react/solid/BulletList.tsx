import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBulletList = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 14a3 3 0 1 1 0 6 3 3 0 0 1 0-6m15 4h-9v-2h9zM6 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6m15 4h-9V6h9z" />
  </Svg>
);
export default SvgBulletList;
