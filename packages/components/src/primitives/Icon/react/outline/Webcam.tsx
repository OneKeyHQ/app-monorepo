import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWebcam = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18 10a6 6 0 1 0-12 0 6 6 0 0 0 12 0m-4 0a2 2 0 1 0-4 0 2 2 0 0 0 4 0m2 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0m4 0a8 8 0 0 1-7 7.936V20h4a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2h4v-2.064A8 8 0 0 1 12 2a8 8 0 0 1 8 8" />
  </Svg>
);
export default SvgWebcam;
