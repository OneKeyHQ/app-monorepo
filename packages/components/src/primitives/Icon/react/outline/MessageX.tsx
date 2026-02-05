import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageX = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5.002 5v12.036h3.65a2 2 0 0 1 1.285.467L12 19.233l2.099-1.737c.359-.297.81-.46 1.276-.46h3.626V5zm8.291 3.293a1 1 0 0 1 1.414 1.414L13.414 11l1.293 1.293a1 1 0 0 1-1.414 1.414L12 12.414l-1.293 1.293a1 1 0 0 1-1.414-1.414L10.586 11 9.293 9.707a1 1 0 1 1 1.414-1.414L12 9.586zm7.71 8.743a2 2 0 0 1-2 2h-3.627l-2.74 2.27a1 1 0 0 1-1.28-.004l-2.704-2.266h-3.65a2 2 0 0 1-1.99-1.796l-.01-.204V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgMessageX;
