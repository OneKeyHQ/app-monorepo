import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckmark1Small = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.152 7.47a1 1 0 0 1 1.696 1.06l-5 8a1 1 0 0 1-1.555.177l-3-3a1 1 0 1 1 1.414-1.414l2.11 2.11z" />
  </Svg>
);
export default SvgCheckmark1Small;
