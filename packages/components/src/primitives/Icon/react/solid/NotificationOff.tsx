import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNotificationOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22.414 21 21 22.414 16.086 17.5H3l.813-8.144a8.2 8.2 0 0 1 .995-3.133L1.586 3 3 1.586z" />
    <Path d="M16.584 19a5.001 5.001 0 0 1-9.168 0zM12 2a8.234 8.234 0 0 1 8.186 7.356L21 17.5h-.671L6.733 3.904A8.2 8.2 0 0 1 12 2" />
  </Svg>
);
export default SvgNotificationOff;
