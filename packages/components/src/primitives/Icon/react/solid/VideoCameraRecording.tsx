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
      d="M2 6a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1.382l2.106-1.053A2 2 0 0 1 22 8.118v7.764a2 2 0 0 1-2.894 1.789L17 16.618V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm7.5 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgVideoCameraRecording;
