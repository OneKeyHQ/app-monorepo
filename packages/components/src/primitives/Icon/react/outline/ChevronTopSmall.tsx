import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronTopSmall = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10.916 9.8a1.72 1.72 0 0 1 2.299.117l3.407 3.407a.982.982 0 1 1-1.389 1.389L12 11.479l-3.233 3.234a.982.982 0 0 1-1.388-1.389l3.406-3.407z" />
  </Svg>
);
export default SvgChevronTopSmall;
