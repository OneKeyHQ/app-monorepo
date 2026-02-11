import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBatteryLoading = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M1 17V7a2 2 0 0 1 2-2h4a1 1 0 0 1 0 2H3v10h1.5a1 1 0 1 1 0 2H3a2 2 0 0 1-2-2M11.2 5.4a1 1 0 1 1 1.6 1.2L9.499 11H13.5a1 1 0 0 1 .8 1.6l-4.5 6a1 1 0 1 1-1.6-1.2l3.301-4.4H7.5a1 1 0 0 1-.8-1.6zM20 14h1v-4h-1zm3 .5a1.5 1.5 0 0 1-1.5 1.5H20v1a2 2 0 0 1-2 2h-4a1 1 0 1 1 0-2h4V7h-1.5a1 1 0 1 1 0-2H18a2 2 0 0 1 2 2v1h1.5A1.5 1.5 0 0 1 23 9.5z" />
  </Svg>
);
export default SvgBatteryLoading;
