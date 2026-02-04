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
      d="M15 4a2 2 0 0 1 2 2v1.382l2.105-1.053A2 2 0 0 1 22 8.12v7.763a2 2 0 0 1-2.895 1.789L17 16.618V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM4 18h11v-3a1 1 0 0 1 1.447-.895L20 15.882V8.118l-3.553 1.777A1 1 0 0 1 15 9V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgVideoCameraRecording;
