import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckmark2Small = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m18.411 7.906-8.362 9.557L5.586 13 7 11.586l2.951 2.951 6.955-7.948z" />
  </Svg>
);
export default SvgCheckmark2Small;
