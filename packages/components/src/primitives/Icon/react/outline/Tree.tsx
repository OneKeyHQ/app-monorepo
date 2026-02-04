import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTree = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 11a7 7 0 1 0-8 6.927v-2.513l-1.707-1.707a1 1 0 1 1 1.414-1.414L12 13.586l2.293-2.293a1 1 0 1 1 1.414 1.414L13 15.414v2.513A7 7 0 0 0 19 11m2 0c0 4.633-3.5 8.445-8 8.942V21a1 1 0 1 1-2 0v-1.058A9 9 0 1 1 21 11" />
  </Svg>
);
export default SvgTree;
