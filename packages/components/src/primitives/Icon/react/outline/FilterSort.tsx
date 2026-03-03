import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFilterSort = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m7 16.584 1.998-1.998L10.412 16 6 20.414 1.584 16l1.414-1.414 2.002 2V4h2zM21 18h-6v-2h6zm0-5h-8v-2h8zm0-5H11V6h10z" />
  </Svg>
);
export default SvgFilterSort;
