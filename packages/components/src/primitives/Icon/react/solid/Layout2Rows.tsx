import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayout2Rows = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 13v8H3v-8zm0-2H3V3h18z" />
  </Svg>
);
export default SvgLayout2Rows;
