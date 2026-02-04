import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFaceArc = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0m-5.447 2.355a1 1 0 0 1 .894 1.79c-2.281 1.14-4.613 1.14-6.894 0a1 1 0 0 1 .894-1.79c1.719.86 3.387.86 5.106 0M9 11V8a1 1 0 0 1 2 0v3a1 1 0 1 1-2 0m4 0V8a1 1 0 1 1 2 0v3a1 1 0 1 1-2 0m9 1c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
  </Svg>
);
export default SvgFaceArc;
