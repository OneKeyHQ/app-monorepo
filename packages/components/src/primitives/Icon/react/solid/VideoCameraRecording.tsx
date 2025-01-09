import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVideoCameraRecording = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 7a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v.382l2.106-1.053A2 2 0 0 1 22 8.118v7.764a2 2 0 0 1-2.894 1.789L17 16.618V17a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7Zm7.5 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgVideoCameraRecording;
