import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCourt = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 21H3v-2h18zm0-16.234V10h-2v8h-2v-7.999h-2V18h-2v-7.999h-2V18H9v-7.999H7V18H5v-7.999H3V4.766l9-2.813z" />
  </Svg>
);
export default SvgCourt;
