import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronDownSmall = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.233 9.288a.982.982 0 1 1 1.389 1.388l-3.407 3.407c-.671.67-1.759.67-2.43 0L7.38 10.676a.982.982 0 1 1 1.388-1.388L12 12.52z" />
  </Svg>
);
export default SvgChevronDownSmall;
