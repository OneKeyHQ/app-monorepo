import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCart = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 17a2 2 0 1 1 0 4 2 2 0 0 1 0-4m9 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4M5.347 5H22.18l-1.834 11H5.153l-2-12H1V2h3.847z" />
  </Svg>
);
export default SvgCart;
