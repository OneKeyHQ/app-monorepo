import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgUpload = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 19h14v-5.25h2V21H3v-7.25h2z" />
    <Path d="M17.914 8.5 16.5 9.914l-3.5-3.5v9.836h-2V6.414l-3.5 3.5L6.086 8.5 12 2.586z" />
  </Svg>
);
export default SvgUpload;
