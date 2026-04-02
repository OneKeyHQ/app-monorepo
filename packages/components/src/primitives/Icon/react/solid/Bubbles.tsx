import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBubbles = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.5 13a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2m10.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7" />
  </Svg>
);
export default SvgBubbles;
