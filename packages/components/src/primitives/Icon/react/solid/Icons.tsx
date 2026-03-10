import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgIcons = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 21H3v-8h8zm9.535-6.122L18.415 17l2.12 2.121-1.414 1.414L17 18.415l-2.121 2.12-1.414-1.414L15.585 17l-2.12-2.122 1.414-1.414L17 15.585l2.121-2.121zM8 6h3v2H8v3H6V8H3V6h3V3h2zm9-3a4 4 0 1 1 0 8 4 4 0 0 1 0-8" />
  </Svg>
);
export default SvgIcons;
