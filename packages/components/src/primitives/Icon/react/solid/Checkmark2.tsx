import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckmark2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22.845 3.92 9.591 22.14l-8.447-6.639 1.853-2.358 6 4.715L20.42 2.155l2.426 1.764Z" />
  </Svg>
);
export default SvgCheckmark2;
