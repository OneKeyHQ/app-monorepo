import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNotificationOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2.293 2.293a1 1 0 0 1 1.414 0l18 18a1 1 0 1 1-1.414 1.414l-3.452-3.452A5.002 5.002 0 0 1 7.1 18H5.112a2 2 0 0 1-1.988-2.214l.689-6.43a8.2 8.2 0 0 1 .998-3.131L2.293 3.707a1 1 0 0 1 0-1.414M9.173 18a2.998 2.998 0 0 0 5.651 0zM6.299 7.712a6.2 6.2 0 0 0-.496 1.857L5.112 16h9.474L6.298 7.712Z"
      clipRule="evenodd"
    />
    <Path d="M12 2a8.234 8.234 0 0 1 8.187 7.356l.486 4.538a1 1 0 0 1-1.988.212l-.487-4.537a6.234 6.234 0 0 0-8.783-5.01 1 1 0 1 1-.83-1.819A8.2 8.2 0 0 1 12 2" />
  </Svg>
);
export default SvgNotificationOff;
