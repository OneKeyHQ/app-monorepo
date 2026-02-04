import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRotateClockwise = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2.972 12a9 9 0 0 1 9-9c2.553 0 4.405.924 6.028 2.427V4a1 1 0 1 1 2 0v3.5A1.5 1.5 0 0 1 18.5 9H15a1 1 0 1 1 0-2h1.756c-1.383-1.32-2.81-2-4.784-2a7 7 0 1 0 6.601 9.333A1 1 0 0 1 20.46 15a9 9 0 0 1-17.487-3Z" />
  </Svg>
);
export default SvgRotateClockwise;
