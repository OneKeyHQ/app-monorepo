import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageInfo = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5.002 5v12.036h3.65a2 2 0 0 1 1.285.467L12 19.233l2.099-1.737c.359-.297.81-.46 1.276-.46h3.626V5zM11 13.75v-2a1 1 0 0 1 2 0v2a1 1 0 0 1-2 0m10.002 3.286a2 2 0 0 1-2 2h-3.626l-2.74 2.27a1 1 0 0 1-1.28-.004l-2.704-2.266h-3.65a2 2 0 0 1-1.99-1.796l-.01-.204V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <Path d="M12 7.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5" />
  </Svg>
);
export default SvgMessageInfo;
