import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloudDisconnected = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m15.414 16-2 2 2 2L14 21.414l-2-2-2 2L8.586 20l2-2-2-2L10 14.586l2 2 2-2z" />
    <Path d="M9 4a8 8 0 0 1 6.979 4.087A6 6 0 0 1 19.4 19.5l-.917.4-.8-1.832.916-.4a4.002 4.002 0 0 0-2.849-7.47 1 1 0 0 1-1.231-.556A6.002 6.002 0 0 0 3 12a5.99 5.99 0 0 0 2.572 4.925l.82.572-1.144 1.64-.82-.572A8 8 0 0 1 9 4" />
  </Svg>
);
export default SvgCloudDisconnected;
