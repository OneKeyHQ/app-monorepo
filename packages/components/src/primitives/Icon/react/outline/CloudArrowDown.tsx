import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloudArrowDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m13 17.586 1.5-1.5 1.414 1.414L12 21.414 8.086 17.5 9.5 16.086l1.5 1.5V13h2z" />
    <Path d="M9 4a8 8 0 0 1 6.979 4.087A6 6 0 0 1 19.4 19.5l-.917.4-.8-1.832.916-.4a4.002 4.002 0 0 0-2.849-7.47l-.871.286-.36-.842A6.002 6.002 0 0 0 3 12a5.99 5.99 0 0 0 2.572 4.925l.82.572-1.144 1.64-.82-.572A8 8 0 0 1 9 4" />
  </Svg>
);
export default SvgCloudArrowDown;
