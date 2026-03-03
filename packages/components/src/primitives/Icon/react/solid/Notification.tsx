import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNotification = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16.584 19a5.001 5.001 0 0 1-9.168 0zM12 2a8.233 8.233 0 0 1 8.187 7.356L21 17.5H3l.814-8.144A8.233 8.233 0 0 1 12 2" />
  </Svg>
);
export default SvgNotification;
