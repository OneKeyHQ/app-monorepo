import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNotificationBadge = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3 19V5a2 2 0 0 1 2-2h6a1 1 0 1 1 0 2H5v14h14v-6a1 1 0 1 1 2 0v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2M15.172 3.172a4 4 0 1 1 5.656 5.655 4 4 0 0 1-5.656-5.655m4.242 1.414a2 2 0 1 0-2.828 2.827 2 2 0 0 0 2.828-2.827" />
  </Svg>
);
export default SvgNotificationBadge;
