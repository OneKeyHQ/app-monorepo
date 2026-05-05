import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShareArrow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M23.505 12 12 1.772v5.72c-3.59-.057-5.51-.428-6.678-1.012-1.18-.59-1.682-1.436-2.427-2.927L1 4c0 4.284.615 7.506 2.581 9.618 1.828 1.964 4.62 2.755 8.419 2.867v5.742z" />
  </Svg>
);
export default SvgShareArrow;
