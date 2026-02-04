import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessage = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4.002 5v12.036h4.65a2 2 0 0 1 1.285.467L12 19.233l2.099-1.737a2 2 0 0 1 1.276-.46h4.626V5zm18 12.036a2 2 0 0 1-2 2h-4.626l-2.74 2.27a1 1 0 0 1-1.28-.004l-2.704-2.266h-4.65a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgMessage;
