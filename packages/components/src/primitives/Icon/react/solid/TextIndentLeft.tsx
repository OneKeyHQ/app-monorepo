import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTextIndentLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22 19H9v-2h13zM7 12l-5 3.5v-7zm15 1H9v-2h13zm0-6H9V5h13z" />
  </Svg>
);
export default SvgTextIndentLeft;
