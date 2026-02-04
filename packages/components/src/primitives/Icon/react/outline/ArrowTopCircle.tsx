import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTopCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0m-9 4v-5.586l-1.293 1.293a1 1 0 1 1-1.414-1.414l3-3 .076-.068a1 1 0 0 1 1.338.068l3 3a1 1 0 1 1-1.414 1.414L13 10.414V16a1 1 0 1 1-2 0m11-4c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
  </Svg>
);
export default SvgArrowTopCircle;
