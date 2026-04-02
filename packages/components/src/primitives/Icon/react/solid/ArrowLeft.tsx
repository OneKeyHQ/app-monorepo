import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m13.122 6.5-4 4h12.879v3H9.122l4 4-2.121 2.12L3.38 12 11 4.379l2.121 2.12Z" />
  </Svg>
);
export default SvgArrowLeft;
