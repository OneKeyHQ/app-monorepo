import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLogin = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 21h-7v-2h5V5h-5V3h7z" />
    <Path d="M15.914 12 11 16.914 9.586 15.5l2.5-2.5H3v-2h9.086l-2.5-2.5L11 7.086z" />
  </Svg>
);
export default SvgLogin;
