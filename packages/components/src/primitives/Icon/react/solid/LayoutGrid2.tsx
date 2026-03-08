import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayoutGrid2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 21H3v-8h8zm10-8v8h-8v-8zm-10-2H3V3h8zm10 0h-8V3h8z" />
  </Svg>
);
export default SvgLayoutGrid2;
