import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFilterSort = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m7.002 16.585 1.998-2L10.414 16l-4.412 4.414L1.586 16 3 14.586l2.002 2V4h2zM21 18h-6v-2h6zm0-5h-8v-2h8zm0-5H11V6h10z" />
  </Svg>
);
export default SvgFilterSort;
