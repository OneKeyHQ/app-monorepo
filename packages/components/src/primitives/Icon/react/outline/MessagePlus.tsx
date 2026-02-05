import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessagePlus = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5.002 5v12.036h3.65a2 2 0 0 1 1.285.467L12 19.233l2.099-1.737c.359-.297.81-.46 1.276-.46h3.626V5zM11 14v-2H9a1 1 0 0 1 0-2h2V8a1 1 0 0 1 2 0v2h2a1 1 0 0 1 0 2h-2v2a1 1 0 0 1-2 0m10.002 3.036a2 2 0 0 1-2 2h-3.626l-2.74 2.27a1 1 0 0 1-1.28-.004l-2.704-2.266h-3.65a2 2 0 0 1-1.99-1.796l-.01-.204V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgMessagePlus;
