import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNotificationOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3.707 2.293a1 1 0 0 0-1.414 1.414L4.775 6.19A8.1 8.1 0 0 0 3.75 9.356l-.725 5.9A2 2 0 0 0 5.011 17.5h11.075l4.207 4.207a1 1 0 0 0 1.414-1.414zm17.267 12.963a2 2 0 0 1-.94 1.95L6.72 3.892A8.32 8.32 0 0 1 12 2c4.208 0 7.802 3.173 8.25 7.356z" />
    <Path d="M7.416 19a5.001 5.001 0 0 0 9.168 0z" />
  </Svg>
);
export default SvgNotificationOff;
