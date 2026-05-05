import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDownload = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 19h14v-5h2v7H3v-7h2z" />
    <Path d="m13 12.086 2.5-2.5L16.914 11 12 15.914 7.086 11 8.5 9.586l2.5 2.5V3h2z" />
  </Svg>
);
export default SvgDownload;
