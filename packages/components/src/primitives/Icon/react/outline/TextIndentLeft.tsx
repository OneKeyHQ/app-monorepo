import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTextIndentLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22 19H9v-2h13zM7.312 12.002 2 15.508V8.476zM22 13H9v-2h13zm0-6H9V5h13z" />
  </Svg>
);
export default SvgTextIndentLeft;
