import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageNotification = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2.002 17.187V5.151a2 2 0 0 1 2-2h8a1 1 0 1 1 0 2h-8v12.036h4.65a2 2 0 0 1 1.285.467L12 19.384l2.099-1.737c.359-.297.81-.46 1.276-.46h4.626V13.17a1 1 0 0 1 2 0v4.018a2 2 0 0 1-2 2h-4.626l-2.74 2.27a1 1 0 0 1-1.28-.004l-2.704-2.266h-4.65a2 2 0 0 1-2-2ZM21 6.151a2 2 0 1 0-4 0 2 2 0 0 0 4 0m2 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0" />
  </Svg>
);
export default SvgMessageNotification;
