import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCodeLines = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 20H2v-2h9zm11 0h-8v-2h8zM9 13H2v-2h7zm13 0H12v-2h10zm-8-7H2V4h12zm8 0h-5V4h5z" />
  </Svg>
);
export default SvgCodeLines;
