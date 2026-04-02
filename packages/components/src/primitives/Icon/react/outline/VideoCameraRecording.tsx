import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVideoCameraRecording = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9.5 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="m17 7.522 5-1.999v12.954l-5-2V20H2V4h15zM4 18h11v-4.477l5 2V8.477l-5 2V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgVideoCameraRecording;
