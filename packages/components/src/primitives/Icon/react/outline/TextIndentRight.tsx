import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTextIndentRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15 19H2v-2h13zm7-3.492-5.311-3.506L22 8.476zM15 13H2v-2h13zm0-6H2V5h13z" />
  </Svg>
);
export default SvgTextIndentRight;
