import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEyeClosed = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 20v-2.405a11 11 0 0 1-1.93-.356l-1.215 2.01a1 1 0 1 1-1.71-1.034l1.023-1.694c-1.395-.672-2.714-1.64-3.897-2.898a1 1 0 0 1 1.458-1.37c2.153 2.29 4.736 3.39 7.271 3.39s5.118-1.1 7.271-3.39a1 1 0 0 1 1.457 1.37c-1.182 1.258-2.502 2.226-3.897 2.898l1.024 1.694a1 1 0 1 1-1.71 1.034l-1.215-2.01a11 11 0 0 1-1.93.356V20a1 1 0 1 1-2 0m1-17c3.142 0 6.237 1.37 8.729 4.019a1 1 0 0 1-1.457 1.37C17.117 6.1 14.534 5 12 5S6.882 6.1 4.729 8.39A1 1 0 0 1 3.27 7.02C5.763 4.37 8.858 3 12 3" />
  </Svg>
);
export default SvgEyeClosed;
